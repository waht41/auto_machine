import {Anthropic} from "@anthropic-ai/sdk";
import {formatResponse} from "@core/prompts/responses";
import {findLastIndex} from "@/shared/array";
import {ClineApiReqInfo, ClineAsk, ClineMessage} from "@/shared/ExtensionMessage";
import path from "path";
import fs from "fs/promises";
import os from "os";

class Tasker {
    constructor() {
    }
    private async startTask(task?: string, images?: string[]): Promise<void> {
        // conversationHistory (for API) and clineMessages (for webview) need to be in sync
        // if the extension process were killed, then on restart the clineMessages might not be empty, so we need to set it to [] when we create a new Cline client (otherwise webview would show stale messages from previous session)
        this.clineMessages = []
        this.apiConversationHistory = []
        await this.providerRef.deref()?.postStateToWebview()

        await this.say("text", task, images)

        let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)
        await this.initiateTaskLoop([
            {
                type: "text",
                text: `<task>\n${task}\n</task>`,
            },
            ...imageBlocks,
        ])
    }
    private async resumeTaskFromHistory() {
        const modifiedClineMessages = await this.getSavedClineMessages()

        // Remove any resume messages that may have been added before
        const lastRelevantMessageIndex = findLastIndex(
            modifiedClineMessages,
            (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
        )
        if (lastRelevantMessageIndex !== -1) {
            modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
        }

        // since we don't use api_req_finished anymore, we need to check if the last api_req_started has a cost value, if it doesn't and no cancellation reason to present, then we remove it since it indicates an api request without any partial content streamed
        const lastApiReqStartedIndex = findLastIndex(
            modifiedClineMessages,
            (m) => m.type === "say" && m.say === "api_req_started",
        )
        if (lastApiReqStartedIndex !== -1) {
            const lastApiReqStarted = modifiedClineMessages[lastApiReqStartedIndex]
            const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastApiReqStarted.text || "{}")
            if (cost === undefined && cancelReason === undefined) {
                modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
            }
        }

        await this.overwriteClineMessages(modifiedClineMessages)
        this.clineMessages = await this.getSavedClineMessages()

        // need to make sure that the api conversation history can be resumed by the api, even if it goes out of sync with cline messages

        let existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
            await this.getSavedApiConversationHistory()

        // Now present the cline messages to the user and ask if they want to resume

        const lastClineMessage = this.clineMessages
            .slice()
            .reverse()
            .find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")) // could be multiple resume tasks
        // const lastClineMessage = this.clineMessages[lastClineMessageIndex]
        // could be a completion result with a command
        // const secondLastClineMessage = this.clineMessages
        // 	.slice()
        // 	.reverse()
        // 	.find(
        // 		(m, index) =>
        // 			index !== lastClineMessageIndex && !(m.ask === "resume_task" || m.ask === "resume_completed_task")
        // 	)
        // (lastClineMessage?.ask === "command" && secondLastClineMessage?.ask === "completion_result")

        let askType: ClineAsk
        if (lastClineMessage?.ask === "completion_result") {
            askType = "resume_completed_task"
        } else {
            askType = "resume_task"
        }

        const { response, text, images } = await this.ask(askType) // calls poststatetowebview
        let responseText: string | undefined
        let responseImages: string[] | undefined
        if (response === "messageResponse") {
            await this.say("user_feedback", text, images)
            responseText = text
            responseImages = images
        }

        // v2.0 xml tags refactor caveat: since we don't use tools anymore, we need to replace all tool use blocks with a text block since the API disallows conversations with tool uses and no tool schema
        const conversationWithoutToolBlocks = existingApiConversationHistory.map((message) => {
            if (Array.isArray(message.content)) {
                const newContent = message.content.map((block) => {
                    if (block.type === "tool_use") {
                        // it's important we convert to the new tool schema format so the model doesn't get confused about how to invoke tools
                        const inputAsXml = Object.entries(block.input as Record<string, string>)
                            .map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
                            .join("\n")
                        return {
                            type: "text",
                            text: `<${block.name}>\n${inputAsXml}\n</${block.name}>`,
                        } as Anthropic.Messages.TextBlockParam
                    } else if (block.type === "tool_result") {
                        // Convert block.content to text block array, removing images
                        const contentAsTextBlocks = Array.isArray(block.content)
                            ? block.content.filter((item) => item.type === "text")
                            : [{ type: "text", text: block.content }]
                        const textContent = contentAsTextBlocks.map((item) => item.text).join("\n\n")
                        const toolName = findToolName(block.tool_use_id, existingApiConversationHistory)
                        return {
                            type: "text",
                            text: `[${toolName} Result]\n\n${textContent}`,
                        } as Anthropic.Messages.TextBlockParam
                    }
                    return block
                })
                return { ...message, content: newContent }
            }
            return message
        })
        existingApiConversationHistory = conversationWithoutToolBlocks

        // FIXME: remove tool use blocks altogether

        // if the last message is an assistant message, we need to check if there's tool use since every tool use has to have a tool response
        // if there's no tool use and only a text block, then we can just add a user message
        // (note this isn't relevant anymore since we use custom tool prompts instead of tool use blocks, but this is here for legacy purposes in case users resume old tasks)

        // if the last message is a user message, we can need to get the assistant message before it to see if it made tool calls, and if so, fill in the remaining tool responses with 'interrupted'

        let modifiedOldUserContent: UserContent // either the last message if its user message, or the user message before the last (assistant) message
        let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[] // need to remove the last user message to replace with new modified user message
        if (existingApiConversationHistory.length > 0) {
            const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

            if (lastMessage.role === "assistant") {
                const content = Array.isArray(lastMessage.content)
                    ? lastMessage.content
                    : [{ type: "text", text: lastMessage.content }]
                const hasToolUse = content.some((block) => block.type === "tool_use")

                if (hasToolUse) {
                    const toolUseBlocks = content.filter(
                        (block) => block.type === "tool_use",
                    ) as Anthropic.Messages.ToolUseBlock[]
                    const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: "Task was interrupted before this tool call could be completed.",
                    }))
                    modifiedApiConversationHistory = [...existingApiConversationHistory] // no changes
                    modifiedOldUserContent = [...toolResponses]
                } else {
                    modifiedApiConversationHistory = [...existingApiConversationHistory]
                    modifiedOldUserContent = []
                }
            } else if (lastMessage.role === "user") {
                const previousAssistantMessage: Anthropic.Messages.MessageParam | undefined =
                    existingApiConversationHistory[existingApiConversationHistory.length - 2]

                const existingUserContent: UserContent = Array.isArray(lastMessage.content)
                    ? lastMessage.content
                    : [{ type: "text", text: lastMessage.content }]
                if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
                    const assistantContent = Array.isArray(previousAssistantMessage.content)
                        ? previousAssistantMessage.content
                        : [{ type: "text", text: previousAssistantMessage.content }]

                    const toolUseBlocks = assistantContent.filter(
                        (block) => block.type === "tool_use",
                    ) as Anthropic.Messages.ToolUseBlock[]

                    if (toolUseBlocks.length > 0) {
                        const existingToolResults = existingUserContent.filter(
                            (block) => block.type === "tool_result",
                        ) as Anthropic.ToolResultBlockParam[]

                        const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
                            .filter(
                                (toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id),
                            )
                            .map((toolUse) => ({
                                type: "tool_result",
                                tool_use_id: toolUse.id,
                                content: "Task was interrupted before this tool call could be completed.",
                            }))

                        modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1) // removes the last user message
                        modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
                    } else {
                        modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
                        modifiedOldUserContent = [...existingUserContent]
                    }
                } else {
                    modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
                    modifiedOldUserContent = [...existingUserContent]
                }
            } else {
                throw new Error("Unexpected: Last message is not a user or assistant message")
            }
        } else {
            throw new Error("Unexpected: No existing API conversation history")
        }

        let newUserContent: UserContent = [...modifiedOldUserContent]

        const agoText = (() => {
            const timestamp = lastClineMessage?.ts ?? Date.now()
            const now = Date.now()
            const diff = now - timestamp
            const minutes = Math.floor(diff / 60000)
            const hours = Math.floor(minutes / 60)
            const days = Math.floor(hours / 24)

            if (days > 0) {
                return `${days} day${days > 1 ? "s" : ""} ago`
            }
            if (hours > 0) {
                return `${hours} hour${hours > 1 ? "s" : ""} ago`
            }
            if (minutes > 0) {
                return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
            }
            return "just now"
        })()

        const wasRecent = lastClineMessage?.ts && Date.now() - lastClineMessage.ts < 30_000

        newUserContent.push({
            type: "text",
            text:
                `[TASK RESUMPTION] This task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now '${cwd.toPosix()}'. If the task has not been completed, retry the last step before interruption and proceed with completing the task.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.${
                    wasRecent
                        ? "\n\nIMPORTANT: If the last tool use was a write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents."
                        : ""
                }` +
                (responseText
                    ? `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`
                    : ""),
        })

        if (responseImages && responseImages.length > 0) {
            newUserContent.push(...formatResponse.imageBlocks(responseImages))
        }

        await this.overwriteApiConversationHistory(modifiedApiConversationHistory)
        await this.initiateTaskLoop(newUserContent)
    }
    private async initiateTaskLoop(userContent: UserContent): Promise<void> {
        let nextUserContent = userContent
        let includeFileDetails = true
        while (!this.abort) {
            const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
            includeFileDetails = false // we only need file details the first time

            //  The way this agentic loop works is that cline will be given a task that he then calls tools to complete. unless there's an attempt_completion call, we keep responding back to him with his tool's responses until he either attempt_completion or does not use anymore tools. If he does not use anymore tools, we ask him to consider if he's completed the task and then call attempt_completion, otherwise proceed with completing the task.
            // There is a MAX_REQUESTS_PER_TASK limit to prevent infinite requests, but Cline is prompted to finish the task as efficiently as he can.

            //const totalCost = this.calculateApiCost(totalInputTokens, totalOutputTokens)
            if (didEndLoop) {
                // For now a task never 'completes'. This will only happen if the user hits max requests and denies resetting the count.
                //this.say("task_completed", `Task completed. Total API usage cost: ${totalCost}`)
                break
            } else {
                // this.say(
                // 	"tool",
                // 	"Cline responded with only text blocks but has not called attempt_completion yet. Forcing him to continue with task..."
                // )
                nextUserContent = [
                    {
                        type: "text",
                        text: formatResponse.noToolsUsed(),
                    },
                ]
                this.consecutiveMistakeCount++
            }
        }
    }

    abortTask() {
        this.abort = true // will stop any autonomously running promises
        this.terminalManager.disposeAll()
        this.urlContentFetcher.closeBrowser()
        this.browserSession.closeBrowser()
    }
}

class History{
    constructor() {
    }
    private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
        const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
        const fileExists = await fileExistsAtPath(filePath)
        if (fileExists) {
            return JSON.parse(await fs.readFile(filePath, "utf8"))
        }
        return []
    }

    private async addToApiConversationHistory(message: Anthropic.MessageParam) {
        const messageWithTs = { ...message, ts: Date.now() }
        this.apiConversationHistory.push(messageWithTs)
        await this.saveApiConversationHistory()
    }

    async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
        this.apiConversationHistory = newHistory
        await this.saveApiConversationHistory()
    }

    private async saveApiConversationHistory() {
        try {
            const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
            await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
        } catch (error) {
            // in the off chance this fails, we don't want to stop the task
            console.error("Failed to save API conversation history:", error)
        }
    }

    private async getSavedClineMessages(): Promise<ClineMessage[]> {
        const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
        if (await fileExistsAtPath(filePath)) {
            return JSON.parse(await fs.readFile(filePath, "utf8"))
        } else {
            // check old location
            const oldPath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
            if (await fileExistsAtPath(oldPath)) {
                const data = JSON.parse(await fs.readFile(oldPath, "utf8"))
                await fs.unlink(oldPath) // remove old file
                return data
            }
        }
        return []
    }

    private async addToClineMessages(message: ClineMessage) {
        this.clineMessages.push(message)
        await this.saveClineMessages()
    }

    public async overwriteClineMessages(newMessages: ClineMessage[]) {
        this.clineMessages = newMessages
        await this.saveClineMessages()
    }

    private async saveClineMessages() {
        try {
            const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
            await fs.writeFile(filePath, JSON.stringify(this.clineMessages))
            // combined as they are in ChatView
            const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))))
            const taskMessage = this.clineMessages[0] // first message is always the task say
            const lastRelevantMessage =
                this.clineMessages[
                    findLastIndex(
                        this.clineMessages,
                        (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
                    )
                    ]
            await this.providerRef.deref()?.updateTaskHistory({
                id: this.taskId,
                ts: lastRelevantMessage.ts,
                task: taskMessage.text ?? "",
                tokensIn: apiMetrics.totalTokensIn,
                tokensOut: apiMetrics.totalTokensOut,
                cacheWrites: apiMetrics.totalCacheWrites,
                cacheReads: apiMetrics.totalCacheReads,
                totalCost: apiMetrics.totalCost,
            })
        } catch (error) {
            console.error("Failed to save cline messages:", error)
        }
    }

}

class Environment {
    constructor() {
    }
    async getEnvironmentDetails(includeFileDetails: boolean = false) {
        let details = ""

        // It could be useful for cline to know if the user went from one or no file to another between messages, so we always include this context
        details += "\n\n# VSCode Visible Files"
        const visibleFiles = vscode.window.visibleTextEditors
            ?.map((editor) => editor.document?.uri?.fsPath)
            .filter(Boolean)
            .map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
            .join("\n")
        if (visibleFiles) {
            details += `\n${visibleFiles}`
        } else {
            details += "\n(No visible files)"
        }

        details += "\n\n# VSCode Open Tabs"
        const openTabs = vscode.window.tabGroups.all
            .flatMap((group) => group.tabs)
            .map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
            .filter(Boolean)
            .map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
            .join("\n")
        if (openTabs) {
            details += `\n${openTabs}`
        } else {
            details += "\n(No open tabs)"
        }

        const busyTerminals = this.terminalManager.getTerminals(true)
        const inactiveTerminals = this.terminalManager.getTerminals(false)
        // const allTerminals = [...busyTerminals, ...inactiveTerminals]

        if (busyTerminals.length > 0 && this.didEditFile) {
            //  || this.didEditFile
            await delay(300) // delay after saving file to let terminals catch up
        }

        // let terminalWasBusy = false
        if (busyTerminals.length > 0) {
            // wait for terminals to cool down
            // terminalWasBusy = allTerminals.some((t) => this.terminalManager.isProcessHot(t.id))
            await pWaitFor(() => busyTerminals.every((t) => !this.terminalManager.isProcessHot(t.id)), {
                interval: 100,
                timeout: 15_000,
            }).catch(() => {})
        }

        // we want to get diagnostics AFTER terminal cools down for a few reasons: terminal could be scaffolding a project, dev servers (compilers like webpack) will first re-compile and then send diagnostics, etc
        /*
        let diagnosticsDetails = ""
        const diagnostics = await this.diagnosticsMonitor.getCurrentDiagnostics(this.didEditFile || terminalWasBusy) // if cline ran a command (ie npm install) or edited the workspace then wait a bit for updated diagnostics
        for (const [uri, fileDiagnostics] of diagnostics) {
            const problems = fileDiagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
            if (problems.length > 0) {
                diagnosticsDetails += `\n## ${path.relative(cwd, uri.fsPath)}`
                for (const diagnostic of problems) {
                    // let severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"
                    const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
                    const source = diagnostic.source ? `[${diagnostic.source}] ` : ""
                    diagnosticsDetails += `\n- ${source}Line ${line}: ${diagnostic.message}`
                }
            }
        }
        */
        this.didEditFile = false // reset, this lets us know when to wait for saved files to update terminals

        // waiting for updated diagnostics lets terminal output be the most up-to-date possible
        let terminalDetails = ""
        if (busyTerminals.length > 0) {
            // terminals are cool, let's retrieve their output
            terminalDetails += "\n\n# Actively Running Terminals"
            for (const busyTerminal of busyTerminals) {
                terminalDetails += `\n## Original command: \`${busyTerminal.lastCommand}\``
                const newOutput = this.terminalManager.getUnretrievedOutput(busyTerminal.id)
                if (newOutput) {
                    terminalDetails += `\n### New Output\n${newOutput}`
                } else {
                    // details += `\n(Still running, no new output)` // don't want to show this right after running the command
                }
            }
        }
        // only show inactive terminals if there's output to show
        if (inactiveTerminals.length > 0) {
            const inactiveTerminalOutputs = new Map<number, string>()
            for (const inactiveTerminal of inactiveTerminals) {
                const newOutput = this.terminalManager.getUnretrievedOutput(inactiveTerminal.id)
                if (newOutput) {
                    inactiveTerminalOutputs.set(inactiveTerminal.id, newOutput)
                }
            }
            if (inactiveTerminalOutputs.size > 0) {
                terminalDetails += "\n\n# Inactive Terminals"
                for (const [terminalId, newOutput] of inactiveTerminalOutputs) {
                    const inactiveTerminal = inactiveTerminals.find((t) => t.id === terminalId)
                    if (inactiveTerminal) {
                        terminalDetails += `\n## ${inactiveTerminal.lastCommand}`
                        terminalDetails += `\n### New Output\n${newOutput}`
                    }
                }
            }
        }

        // details += "\n\n# VSCode Workspace Errors"
        // if (diagnosticsDetails) {
        // 	details += diagnosticsDetails
        // } else {
        // 	details += "\n(No errors detected)"
        // }

        if (terminalDetails) {
            details += terminalDetails
        }

        // Add current time information with timezone
        const now = new Date()
        const formatter = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
        })
        const timeZone = formatter.resolvedOptions().timeZone
        const timeZoneOffset = -now.getTimezoneOffset() / 60 // Convert to hours and invert sign to match conventional notation
        const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : ""}${timeZoneOffset}:00`
        details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`

        // Add current mode and any mode-specific warnings
        const { mode, customModes } = (await this.providerRef.deref()?.getState()) ?? {}
        const currentMode = mode ?? defaultModeSlug
        details += `\n\n# Current Mode\n${currentMode}`

        // Add warning if not in code mode
        if (
            !isToolAllowedForMode("write_to_file", currentMode, customModes ?? [], {
                apply_diff: this.diffEnabled,
            }) &&
            !isToolAllowedForMode("apply_diff", currentMode, customModes ?? [], { apply_diff: this.diffEnabled })
        ) {
            const currentModeName = getModeBySlug(currentMode, customModes)?.name ?? currentMode
            const defaultModeName = getModeBySlug(defaultModeSlug, customModes)?.name ?? defaultModeSlug
            details += `\n\nNOTE: You are currently in '${currentModeName}' mode which only allows read-only operations. To write files or execute commands, the user will need to switch to '${defaultModeName}' mode. Note that only the user can switch modes.`
        }

        if (includeFileDetails) {
            details += `\n\n# Current Working Directory (${cwd.toPosix()}) Files\n`
            const isDesktop = arePathsEqual(cwd, path.join(os.homedir(), "Desktop"))
            if (isDesktop) {
                // don't want to immediately access desktop since it would show permission popup
                details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
            } else {
                const [files, didHitLimit] = await listFiles(cwd, true, 200)
                const result = formatResponse.formatFilesList(cwd, files, didHitLimit)
                details += result
            }
        }

        return `<environment_details>\n${details.trim()}\n</environment_details>`
    }
    async loadContext(userContent: UserContent, includeFileDetails: boolean = false) {
        return await Promise.all([
            // Process userContent array, which contains various block types:
            // TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
            // We need to apply parseMentions() to:
            // 1. All TextBlockParam's text (first user message with task)
            // 2. ToolResultBlockParam's content/context text arrays if it contains "<feedback>" (see formatToolDeniedFeedback, attemptCompletion, executeCommand, and consecutiveMistakeCount >= 3) or "<answer>" (see askFollowupQuestion), we place all user generated content in these tags so they can effectively be used as markers for when we should parse mentions)
            Promise.all(
                userContent.map(async (block) => {
                    const shouldProcessMentions = (text: string) =>
                        text.includes("<task>") || text.includes("<feedback>")

                    if (block.type === "text") {
                        if (shouldProcessMentions(block.text)) {
                            return {
                                ...block,
                                text: await parseMentions(block.text, cwd, this.urlContentFetcher),
                            }
                        }
                        return block
                    } else if (block.type === "tool_result") {
                        if (typeof block.content === "string") {
                            if (shouldProcessMentions(block.content)) {
                                return {
                                    ...block,
                                    content: await parseMentions(block.content, cwd, this.urlContentFetcher),
                                }
                            }
                            return block
                        } else if (Array.isArray(block.content)) {
                            const parsedContent = await Promise.all(
                                block.content.map(async (contentBlock) => {
                                    if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
                                        return {
                                            ...contentBlock,
                                            text: await parseMentions(contentBlock.text, cwd, this.urlContentFetcher),
                                        }
                                    }
                                    return contentBlock
                                }),
                            )
                            return {
                                ...block,
                                content: parsedContent,
                            }
                        }
                        return block
                    }
                    return block
                }),
            ),
            this.getEnvironmentDetails(includeFileDetails),
        ])
    }
    async updateDiffStrategy(experimentalDiffStrategy?: boolean) {
        // If not provided, get from current state
        if (experimentalDiffStrategy === undefined) {
            const { experimentalDiffStrategy: stateExperimentalDiffStrategy } =
            (await this.providerRef.deref()?.getState()) ?? {}
            experimentalDiffStrategy = stateExperimentalDiffStrategy ?? false
        }
        this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy)
    }
    private async ensureTaskDirectoryExists(): Promise<string> {
        const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
        if (!globalStoragePath) {
            throw new Error("Global storage uri is invalid")
        }
        const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
        await fs.mkdir(taskDir, { recursive: true })
        return taskDir
    }

}

class MachineArm {
    constructor() {
    }
    async executeCommandTool(command: string): Promise<[boolean, ToolResponse]> {
        const terminalInfo = await this.terminalManager.getOrCreateTerminal(cwd)
        terminalInfo.terminal.show() // weird visual bug when creating new terminals (even manually) where there's an empty space at the top.
        const process = this.terminalManager.runCommand(terminalInfo, command)

        let userFeedback: { text?: string; images?: string[] } | undefined
        let didContinue = false
        const sendCommandOutput = async (line: string): Promise<void> => {
            try {
                const { response, text, images } = await this.ask("command_output", line)
                if (response === "yesButtonClicked") {
                    // proceed while running
                } else {
                    userFeedback = { text, images }
                }
                didContinue = true
                process.continue() // continue past the await
            } catch {
                // This can only happen if this ask promise was ignored, so ignore this error
            }
        }

        let lines: string[] = []
        process.on("line", (line) => {
            lines.push(line)
            if (!didContinue) {
                sendCommandOutput(line)
            } else {
                this.say("command_output", line)
            }
        })

        let completed = false
        process.once("completed", () => {
            completed = true
        })

        process.once("no_shell_integration", async () => {
            await this.say("shell_integration_warning")
        })

        await process

        // Wait for a short delay to ensure all messages are sent to the webview
        // This delay allows time for non-awaited promises to be created and
        // for their associated messages to be sent to the webview, maintaining
        // the correct order of messages (although the webview is smart about
        // grouping command_output messages despite any gaps anyways)
        await delay(50)

        const { terminalOutputLineLimit } = (await this.providerRef.deref()?.getState()) ?? {}
        const output = truncateOutput(lines.join("\n"), terminalOutputLineLimit)
        const result = output.trim()

        if (userFeedback) {
            await this.say("user_feedback", userFeedback.text, userFeedback.images)
            return [
                true,
                formatResponse.toolResult(
                    `Command is still running in the user's terminal.${
                        result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
                    }\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`,
                    userFeedback.images,
                ),
            ]
        }

        if (completed) {
            return [false, `Command executed.${result.length > 0 ? `\nOutput:\n${result}` : ""}`]
        } else {
            return [
                false,
                `Command is still running in the user's terminal.${
                    result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
                }\n\nYou will be updated on the terminal status and new output in the future.`,
            ]
        }
    }

}