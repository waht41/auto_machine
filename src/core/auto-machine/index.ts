import {ApiHandler, buildApiHandler} from "@/api";
import {ApiConfiguration} from "@/shared/api";
import {Anthropic} from "@anthropic-ai/sdk";
import {findLastIndex} from "@/shared/array";
import {ClineApiReqCancelReason, ClineApiReqInfo, ClineAsk, ClineMessage, ClineSay} from "@/shared/ExtensionMessage";
import {ClineAskResponse} from "@/shared/WebviewMessage";
import {formatResponse} from "@/core/prompts/responses";
import {ApiStream} from "@/api/transform/stream";
import {calculateApiCost} from "@/utils/cost";
import {McpHub} from "@/services/mcp/McpHub";
import {SYSTEM_PROMPT} from "@core/prompts/system";
import {truncateHalfConversation} from "@core/sliding-window";
import {AssistantMessageContent, parseAssistantMessage} from "@core/assistant-message";
import {DiffStrategy} from "@core/diff/types";
import crypto from "crypto";
import pWaitFor from "p-wait-for"
import {formatContentBlockToMarkdown} from "@/integrations/misc/export-markdown";
import delay from "delay";
import {serializeError} from "serialize-error"
import {DiffViewProvider} from "@/integrations/editor/DiffViewProvider";
import path from "path";
import os from "os";
import {parseMentions} from "@core/mentions";
import {UrlContentFetcher} from "@/services/browser/UrlContentFetcher";
import * as vscode from "vscode";
import {defaultModeSlug, getModeBySlug, isToolAllowedForMode} from "@/shared/modes";
import {arePathsEqual} from "@/utils/path";
import {TerminalManager} from "@/integrations/terminal/TerminalManager";
import {listFiles} from "@/services/glob/list-files";
import {MachineProvider} from "@core/auto-machine/machine-provider";

const cwd = process.cwd()
type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
type UserContent = Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>
const machineProvider = new MachineProvider()

class MachineContext {
    api: ApiHandler
    urlContentFetcher: UrlContentFetcher
    terminalManager: TerminalManager
    abort: boolean = false
    consecutiveMistakeCount: number = 0
    clineMessages: ClineMessage[] = []
    lastMessageTs: number = 0
    providerRef: WeakRef<MachineProvider>
    readonly taskId: string
    didEditFile: boolean = false
    customInstructions?: string
    diffStrategy?: DiffStrategy
    diffEnabled: boolean = false
    fuzzyMatchThreshold: number = 1.0

    apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = []
    askResponse?: ClineAskResponse
    askResponseText?: string
    askResponseImages?: string[]
    consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
    didFinishAborting = false
    abandoned = false
    diffViewProvider: DiffViewProvider

    // streaming
    currentStreamingContentIndex = 0
    assistantMessageContent: AssistantMessageContent[] = []
    presentAssistantMessageLocked = false
    presentAssistantMessageHasPendingUpdates = false
    userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
    userMessageContentReady = false
    didRejectTool = false
    didAlreadyUseTool = false
    didCompleteReadingStream = false

    constructor(apiConfiguration: ApiConfiguration){
        this.taskId = crypto.randomUUID()
        this.api = buildApiHandler(apiConfiguration)
        this.diffViewProvider = new DiffViewProvider(cwd)
        this.urlContentFetcher = new UrlContentFetcher({globalStorageUri:{fsPath: cwd}})
        this.terminalManager = new TerminalManager()
        this.providerRef = new WeakRef(machineProvider)
    }
    async addToClineMessages(message: ClineMessage) {
        this.clineMessages.push(message)
    }
    async saveClineMessages(): Promise<void> {
        console.log('saveClineMessages')
        // const clineMessagesPath = path.join(os.tmpdir(), "clineMessages.json")
        // await fs.writeFile(clineMessagesPath, JSON.stringify(this.clineMessages, null, 2))
    }

    async addToApiConversationHistory(message: Anthropic.MessageParam & { ts?: number }) {
        this.apiConversationHistory.push(message)
    }

    abortTask() {
        console.log('abortTask')
    }

    overwriteApiConversationHistory(messages: (Anthropic.MessageParam & { ts?: number })[]) {
        this.apiConversationHistory = messages
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

    async getEnvironmentDetails(includeFileDetails: boolean = false) {
        let details = ""

        // It could be useful for cline to know if the user went from one or no file to another between messages, so we always include this context
        details += "\n\n# Visible Files"
        const visibleFiles = "E:\\project\\javascript\\auto_machine\\src\\a.txt"  //todo waht
        if (visibleFiles) {
            details += `\n${visibleFiles}`
        } else {
            details += "\n(No visible files)"
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
}

export class AutoMachine{
    context: MachineContext
    chatter: Chatter
    constructor(apiConfiguration: ApiConfiguration){
        this.context = new MachineContext(apiConfiguration)
        this.chatter = new Chatter(this.context)
    }

    async receiveText(text: string): Promise<boolean>{
        const userContent: UserContent = [{type: "text", text}]
        return await this.receiveUserContent(userContent)
    }

    async receiveUserContent(userContent: UserContent, includeFileDetails: boolean = false): Promise<boolean>{
        return await this.chatter.recursivelyMakeClineRequests(userContent, includeFileDetails)
    }



}

class Chatter {
    constructor(private context: MachineContext){}
    async say(type: ClineSay, text?: string, images?: string[], partial?: boolean): Promise<undefined> {
        if (this.context.abort) {
            throw new Error("Roo Code instance aborted")
        }

        if (partial !== undefined) {
            const lastMessage = this.context.clineMessages.at(-1)
            const isUpdatingPreviousPartial =
                lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type
            if (partial) {
                if (isUpdatingPreviousPartial) {
                    // existing partial message, so update it
                    lastMessage.text = text
                    lastMessage.images = images
                    lastMessage.partial = partial
                    await this.context.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
                } else {
                    // this is a new partial message, so add it with partial state
                    const sayTs = Date.now()
                    this.context.lastMessageTs = sayTs
                    await this.context.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images, partial })
                    await this.context.providerRef.deref()?.postStateToWebview()
                }
            } else {
                // partial=false means its a complete version of a previously partial message
                if (isUpdatingPreviousPartial) {
                    // this is the complete version of a previously partial message, so replace the partial with the complete version
                    this.context.lastMessageTs = lastMessage.ts
                    // lastMessage.ts = sayTs
                    lastMessage.text = text
                    lastMessage.images = images
                    lastMessage.partial = false

                    // instead of streaming partialMessage events, we do a save and post like normal to persist to disk
                    await this.context.saveClineMessages()
                    // await this.context.providerRef.deref()?.postStateToWebview()
                    await this.context.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage }) // more performant than an entire postStateToWebview
                } else {
                    // this is a new partial=false message, so add it like normal
                    const sayTs = Date.now()
                    this.context.lastMessageTs = sayTs
                    await this.context.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images })
                    await this.context.providerRef.deref()?.postStateToWebview()
                }
            }
        } else {
            // this is a new non-partial message, so add it like normal
            const sayTs = Date.now()
            this.context.lastMessageTs = sayTs
            await this.context.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images })
            await this.context.providerRef.deref()?.postStateToWebview()
        }
    }
    // partial has three valid states true (partial message), false (completion of partial message), undefined (individual complete message)
    async ask(
        type: ClineAsk,
        text?: string,
        partial?: boolean,
    ): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
        // If this Cline instance was aborted by the provider, then the only thing keeping us alive is a promise still running in the background, in which case we don't want to send its result to the webview as it is attached to a new instance of Cline now. So we can safely ignore the result of any active promises, and this class will be deallocated. (Although we set Cline = undefined in provider, that simply removes the reference to this instance, but the instance is still alive until this promise resolves or rejects.)
        if (this.context.abort) {
            throw new Error("Roo Code instance aborted")
        }
        let askTs: number
        if (partial !== undefined) {
            const lastMessage = this.context.clineMessages.at(-1)
            const isUpdatingPreviousPartial =
                lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type
            if (partial) {
                if (isUpdatingPreviousPartial) {
                    // existing partial message, so update it
                    lastMessage.text = text
                    lastMessage.partial = partial
                    // todo be more efficient about saving and posting only new data or one whole message at a time so ignore partial for saves, and only post parts of partial message instead of whole array in new listener
                    // await this.context.saveClineMessages()
                    // await this.context.providerRef.deref()?.postStateToWebview()
                    await this.context.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
                    throw new Error("Current ask promise was ignored 1")
                } else {
                    // this is a new partial message, so add it with partial state
                    // this.context.askResponse = undefined
                    // this.context.askResponseText = undefined
                    // this.context.askResponseImages = undefined
                    askTs = Date.now()
                    this.context.lastMessageTs = askTs
                    await this.context.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial })
                    await this.context.providerRef.deref()?.postStateToWebview()
                    throw new Error("Current ask promise was ignored 2")
                }
            } else {
                // partial=false means its a complete version of a previously partial message
                if (isUpdatingPreviousPartial) {
                    // this is the complete version of a previously partial message, so replace the partial with the complete version
                    this.context.askResponse = undefined
                    this.context.askResponseText = undefined
                    this.context.askResponseImages = undefined

                    /*
                    Bug for the history books:
                    In the webview we use the ts as the chatrow key for the virtuoso list. Since we would update this ts right at the end of streaming, it would cause the view to flicker. The key prop has to be stable otherwise react has trouble reconciling items between renders, causing unmounting and remounting of components (flickering).
                    The lesson here is if you see flickering when rendering lists, it's likely because the key prop is not stable.
                    So in this case we must make sure that the message ts is never altered after first setting it.
                    */
                    askTs = lastMessage.ts
                    this.context.lastMessageTs = askTs
                    // lastMessage.ts = askTs
                    lastMessage.text = text
                    lastMessage.partial = false
                    await this.context.saveClineMessages()
                    // await this.context.providerRef.deref()?.postStateToWebview()
                    await this.context.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
                } else {
                    // this is a new partial=false message, so add it like normal
                    this.context.askResponse = undefined
                    this.context.askResponseText = undefined
                    this.context.askResponseImages = undefined
                    askTs = Date.now()
                    this.context.lastMessageTs = askTs
                    await this.context.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
                    await this.context.providerRef.deref()?.postStateToWebview()
                }
            }
        } else {
            // this is a new non-partial message, so add it like normal
            // const lastMessage = this.context.clineMessages.at(-1)
            this.context.askResponse = undefined
            this.context.askResponseText = undefined
            this.context.askResponseImages = undefined
            askTs = Date.now()
            this.context.lastMessageTs = askTs
            await this.context.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
            await this.context.providerRef.deref()?.postStateToWebview()
        }

        await pWaitFor(() => this.context.askResponse !== undefined || this.context.lastMessageTs !== askTs, { interval: 100 })
        if (this.context.lastMessageTs !== askTs) {
            throw new Error("Current ask promise was ignored") // could happen if we send multiple asks in a row i.e. with command_output. It's important that when we know an ask could fail, it is handled gracefully
        }
        const result = { response: this.context.askResponse!, text: this.context.askResponseText, images: this.context.askResponseImages }
        this.context.askResponse = undefined
        this.context.askResponseText = undefined
        this.context.askResponseImages = undefined
        return result
    }
    async *attemptApiRequest(previousApiReqIndex: number): ApiStream {
        let mcpHub: McpHub | undefined

        const { mcpEnabled, alwaysApproveResubmit, requestDelaySeconds } =
        (await this.context.providerRef.deref()?.getState()) ?? {}

        if (mcpEnabled ?? true) {
            mcpHub = this.context.providerRef.deref()?.mcpHub
            if (!mcpHub) {
                throw new Error("MCP hub not available")
            }
            // Wait for MCP servers to be connected before generating system prompt
            await pWaitFor(() => mcpHub!.isConnecting !== true, { timeout: 10_000 }).catch(() => {
                console.error("MCP servers failed to connect in time")
            })
        }

        const { browserViewportSize, mode, customModePrompts, preferredLanguage } =
        (await this.context.providerRef.deref()?.getState()) ?? {}
        const { customModes } = (await this.context.providerRef.deref()?.getState()) ?? {}
        const systemPrompt = await (async () => {
            const provider = this.context.providerRef.deref()
            if (!provider) {
                throw new Error("Provider not available")
            }
            return SYSTEM_PROMPT(
                provider.context,
                cwd,
                this.context.api.getModel().info.supportsComputerUse ?? false,
                mcpHub,
                this.context.diffStrategy,
                browserViewportSize,
                mode,
                customModePrompts,
                customModes,
                this.context.customInstructions,
                preferredLanguage,
                this.context.diffEnabled,
            )
        })()

        // If the previous API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
        if (previousApiReqIndex >= 0) {
            const previousRequest = this.context.clineMessages[previousApiReqIndex]
            if (previousRequest && previousRequest.text) {
                const { tokensIn, tokensOut, cacheWrites, cacheReads }: ClineApiReqInfo = JSON.parse(
                    previousRequest.text,
                )
                const totalTokens = (tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0)
                const contextWindow = this.context.api.getModel().info.contextWindow || 128_000
                const maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
                if (totalTokens >= maxAllowedSize) {
                    const truncatedMessages = truncateHalfConversation(this.context.apiConversationHistory)
                    await this.context.overwriteApiConversationHistory(truncatedMessages)
                }
            }
        }

        // Clean conversation history by:
        // 1. Converting to Anthropic.MessageParam by spreading only the API-required properties
        // 2. Converting image blocks to text descriptions if model doesn't support images
        const cleanConversationHistory = this.context.apiConversationHistory.map(({ role, content }) => {
            // Handle array content (could contain image blocks)
            if (Array.isArray(content)) {
                if (!this.context.api.getModel().info.supportsImages) {
                    // Convert image blocks to text descriptions
                    content = content.map((block) => {
                        if (block.type === "image") {
                            // Convert image blocks to text descriptions
                            // Note: We can't access the actual image content/url due to API limitations,
                            // but we can indicate that an image was present in the conversation
                            return {
                                type: "text",
                                text: "[Referenced image in conversation]",
                            }
                        }
                        return block
                    })
                }
            }
            return { role, content }
        })
        const stream = this.context.api.createMessage(systemPrompt, cleanConversationHistory)
        const iterator = stream[Symbol.asyncIterator]()

        try {
            // awaiting first chunk to see if it will throw an error
            const firstChunk = await iterator.next()
            yield firstChunk.value
        } catch (error) {
            // note that this api_req_failed ask is unique in that we only present this option if the api hasn't streamed any content yet (ie it fails on the first chunk due), as it would allow them to hit a retry button. However if the api failed mid-stream, it could be in any arbitrary state where some tools may have executed, so that error is handled differently and requires cancelling the task entirely.
            if (alwaysApproveResubmit) {
                const errorMsg = error.message ?? "Unknown error"
                const requestDelay = requestDelaySeconds || 5
                // Automatically retry with delay
                // Show countdown timer in error color
                for (let i = requestDelay; i > 0; i--) {
                    await this.say(
                        "api_req_retry_delayed",
                        `${errorMsg}\n\nRetrying in ${i} seconds...`,
                        undefined,
                        true,
                    )
                    await delay(1000)
                }
                await this.say("api_req_retry_delayed", `${errorMsg}\n\nRetrying now...`, undefined, false)
                // delegate generator output from the recursive call
                yield* this.attemptApiRequest(previousApiReqIndex)
                return
            } else {
                const { response } = await this.ask(
                    "api_req_failed",
                    error.message ?? JSON.stringify(serializeError(error), null, 2),
                )
                if (response !== "yesButtonClicked") {
                    // this will never happen since if noButtonClicked, we will clear current task, aborting this instance
                    throw new Error("API request failed")
                }
                await this.say("api_req_retried")
                // delegate generator output from the recursive call
                yield* this.attemptApiRequest(previousApiReqIndex)
                return
            }
        }

        // no error, so we can continue to yield all remaining chunks
        // (needs to be placed outside of try/catch since it we want caller to handle errors not with api_req_failed as that is reserved for first chunk failures only)
        // this delegates to another generator or iterable object. In this case, it's saying "yield all remaining values from this iterator". This effectively passes along all subsequent chunks from the original stream.
        yield* iterator
    }
    async recursivelyMakeClineRequests(
        userContent: UserContent,
        includeFileDetails: boolean = false,
    ): Promise<boolean> {
        if (this.context.abort) {
            throw new Error("Roo Code instance aborted")
        }

        if (this.context.consecutiveMistakeCount >= 3) {
            const { response, text, images } = await this.ask(
                "mistake_limit_reached",
                this.context.api.getModel().id.includes("claude")
                    ? `This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").`
                    : "Roo Code uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.5 Sonnet for its advanced agentic coding capabilities.",
            )
            if (response === "messageResponse") {
                userContent.push(
                    ...[
                        {
                            type: "text",
                            text: formatResponse.tooManyMistakes(text),
                        } as Anthropic.Messages.TextBlockParam,
                        ...formatResponse.imageBlocks(images),
                    ],
                )
            }
            this.context.consecutiveMistakeCount = 0
        }

        // get previous api req's index to check token usage and determine if we need to truncate conversation history
        const previousApiReqIndex = findLastIndex(this.context.clineMessages, (m) => m.say === "api_req_started")

        // getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
        // for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
        await this.say(
            "api_req_started",
            JSON.stringify({
                request:
                    userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n") + "\n\nLoading...",
            }),
        )

        const [parsedUserContent, environmentDetails] = await this.context.loadContext(userContent, includeFileDetails)
        userContent = parsedUserContent
        // add environment details as its own text block, separate from tool results
        userContent.push({ type: "text", text: environmentDetails })

        await this.context.addToApiConversationHistory({ role: "user", content: userContent })

        // since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
        const lastApiReqIndex = findLastIndex(this.context.clineMessages, (m) => m.say === "api_req_started")
        this.context.clineMessages[lastApiReqIndex].text = JSON.stringify({
            request: userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n"),
        } satisfies ClineApiReqInfo)
        await this.context.saveClineMessages()
        await this.context.providerRef.deref()?.postStateToWebview()

        try {
            let cacheWriteTokens = 0
            let cacheReadTokens = 0
            let inputTokens = 0
            let outputTokens = 0
            let totalCost: number | undefined

            // update api_req_started. we can't use api_req_finished anymore since it's a unique case where it could come after a streaming message (ie in the middle of being updated or executed)
            // fortunately api_req_finished was always parsed out for the gui anyways, so it remains solely for legacy purposes to keep track of prices in tasks from history
            // (it's worth removing a few months from now)
            const updateApiReqMsg = (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
                this.context.clineMessages[lastApiReqIndex].text = JSON.stringify({
                    ...JSON.parse(this.context.clineMessages[lastApiReqIndex].text || "{}"),
                    tokensIn: inputTokens,
                    tokensOut: outputTokens,
                    cacheWrites: cacheWriteTokens,
                    cacheReads: cacheReadTokens,
                    cost:
                        totalCost ??
                        calculateApiCost(
                            this.context.api.getModel().info,
                            inputTokens,
                            outputTokens,
                            cacheWriteTokens,
                            cacheReadTokens,
                        ),
                    cancelReason,
                    streamingFailedMessage,
                } satisfies ClineApiReqInfo)
            }

            const abortStream = async (cancelReason: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
                if (this.context.diffViewProvider.isEditing) {
                    await this.context.diffViewProvider.revertChanges() // closes diff view
                }

                // if last message is a partial we need to update and save it
                const lastMessage = this.context.clineMessages.at(-1)
                if (lastMessage && lastMessage.partial) {
                    // lastMessage.ts = Date.now() DO NOT update ts since it is used as a key for virtuoso list
                    lastMessage.partial = false
                    // instead of streaming partialMessage events, we do a save and post like normal to persist to disk
                    console.log("updating partial message", lastMessage)
                    // await this.context.saveClineMessages()
                }

                // Let assistant know their response was interrupted for when task is resumed
                await this.context.addToApiConversationHistory({
                    role: "assistant",
                    content: [
                        {
                            type: "text",
                            text:
                                assistantMessage +
                                `\n\n[${
                                    cancelReason === "streaming_failed"
                                        ? "Response interrupted by API Error"
                                        : "Response interrupted by user"
                                }]`,
                        },
                    ],
                })

                // update api_req_started to have cancelled and cost, so that we can display the cost of the partial stream
                updateApiReqMsg(cancelReason, streamingFailedMessage)
                await this.context.saveClineMessages()

                // signals to provider that it can retrieve the saved messages from disk, as abortTask can not be awaited on in nature
                this.context.didFinishAborting = true
            }

            // reset streaming state
            this.context.currentStreamingContentIndex = 0
            this.context.assistantMessageContent = []
            this.context.didCompleteReadingStream = false
            this.context.userMessageContent = []
            this.context.userMessageContentReady = false
            this.context.didRejectTool = false
            this.context.didAlreadyUseTool = false
            this.context.presentAssistantMessageLocked = false
            this.context.presentAssistantMessageHasPendingUpdates = false
            await this.context.diffViewProvider.reset()

            const stream = this.attemptApiRequest(previousApiReqIndex) // yields only if the first chunk is successful, otherwise will allow the user to retry the request (most likely due to rate limit error, which gets thrown on the first chunk)
            let assistantMessage = ""
            let reasoningMessage = ""
            try {
                for await (const chunk of stream) {
                    switch (chunk.type) {
                        case "reasoning":
                            reasoningMessage += chunk.text
                            await this.say("reasoning", reasoningMessage, undefined, true)
                            break
                        case "usage":
                            inputTokens += chunk.inputTokens
                            outputTokens += chunk.outputTokens
                            cacheWriteTokens += chunk.cacheWriteTokens ?? 0
                            cacheReadTokens += chunk.cacheReadTokens ?? 0
                            totalCost = chunk.totalCost
                            break
                        case "text":
                            assistantMessage += chunk.text
                            // parse raw assistant message into content blocks
                            const prevLength = this.context.assistantMessageContent.length
                            this.context.assistantMessageContent = parseAssistantMessage(assistantMessage)
                            if (this.context.assistantMessageContent.length > prevLength) {
                                this.context.userMessageContentReady = false // new content we need to present, reset to false in case previous content set this to true
                            }
                            // present content to user
                            // this.context.presentAssistantMessage() // todo waht presentAssistantMessage
                            console.log(chunk.text)
                            break
                    }

                    if (this.context.abort) {
                        console.log("aborting stream...")
                        if (!this.context.abandoned) {
                            // only need to gracefully abort if this instance isn't abandoned (sometimes openrouter stream hangs, in which case this would affect future instances of cline)
                            await abortStream("user_cancelled")
                        }
                        break // aborts the stream
                    }

                    if (this.context.didRejectTool) {
                        // userContent has a tool rejection, so interrupt the assistant's response to present the user's feedback
                        assistantMessage += "\n\n[Response interrupted by user feedback]"
                        // this.context.userMessageContentReady = true // instead of setting this premptively, we allow the present iterator to finish and set userMessageContentReady when its ready
                        break
                    }

                    // PREV: we need to let the request finish for openrouter to get generation details
                    // UPDATE: it's better UX to interrupt the request at the cost of the api cost not being retrieved
                    if (this.context.didAlreadyUseTool) {
                        assistantMessage +=
                            "\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
                        break
                    }
                }
            } catch (error) {
                // abandoned happens when extension is no longer waiting for the cline instance to finish aborting (error is thrown here when any function in the for loop throws due to this.context.abort)
                if (!this.context.abandoned) {
                    this.context.abortTask() // if the stream failed, there's various states the task could be in (i.e. could have streamed some tools the user may have executed), so we just resort to replicating a cancel task
                    await abortStream(
                        "streaming_failed",
                        error.message ?? JSON.stringify(serializeError(error), null, 2),
                    )
                    const history = await this.context.providerRef.deref()?.getTaskWithId(this.context.taskId)
                    if (history) {
                        await this.context.providerRef.deref()?.initClineWithHistoryItem(history.historyItem)
                        // await this.context.providerRef.deref()?.postStateToWebview()
                    }
                }
            }

            // need to call here in case the stream was aborted
            if (this.context.abort) {
                throw new Error("Roo Code instance aborted")
            }

            this.context.didCompleteReadingStream = true

            // set any blocks to be complete to allow presentAssistantMessage to finish and set userMessageContentReady to true
            // (could be a text block that had no subsequent tool uses, or a text block at the very end, or an invalid tool use, etc. whatever the case, presentAssistantMessage relies on these blocks either to be completed or the user to reject a block in order to proceed and eventually set userMessageContentReady to true)
            const partialBlocks = this.context.assistantMessageContent.filter((block) => block.partial)
            partialBlocks.forEach((block) => {
                block.partial = false
            })
            // this.context.assistantMessageContent.forEach((e) => (e.partial = false)) // cant just do this bc a tool could be in the middle of executing ()
            if (partialBlocks.length > 0) {
                // this.context.presentAssistantMessage() // if there is content to update then it will complete and update this.context.userMessageContentReady to true, which we pwaitfor before making the next request. all this is really doing is presenting the last partial message that we just set to complete
                // todo waht
            }

            updateApiReqMsg()
            await this.context.saveClineMessages()
            await this.context.providerRef.deref()?.postStateToWebview()

            // now add to apiconversationhistory
            // need to save assistant responses to file before proceeding to tool use since user can exit at any moment and we wouldn't be able to save the assistant's response
            let didEndLoop = false
            if (assistantMessage.length > 0) {
                await this.context.addToApiConversationHistory({
                    role: "assistant",
                    content: [{ type: "text", text: assistantMessage }],
                })

                // NOTE: this comment is here for future reference - this was a workaround for userMessageContent not getting set to true. It was due to it not recursively calling for partial blocks when didRejectTool, so it would get stuck waiting for a partial block to complete before it could continue.
                // in case the content blocks finished
                // it may be the api stream finished after the last parsed content block was executed, so  we are able to detect out of bounds and set userMessageContentReady to true (note you should not call presentAssistantMessage since if the last block is completed it will be presented again)
                // const completeBlocks = this.context.assistantMessageContent.filter((block) => !block.partial) // if there are any partial blocks after the stream ended we can consider them invalid
                // if (this.context.currentStreamingContentIndex >= completeBlocks.length) {
                // 	this.context.userMessageContentReady = true
                // }

                await pWaitFor(() => this.context.userMessageContentReady)

                // if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
                const didToolUse = this.context.assistantMessageContent.some((block) => block.type === "tool_use")
                if (!didToolUse) {
                    this.context.userMessageContent.push({
                        type: "text",
                        text: formatResponse.noToolsUsed(),
                    })
                    this.context.consecutiveMistakeCount++
                }

                didEndLoop = await this.recursivelyMakeClineRequests(this.context.userMessageContent)
            } else {
                // if there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
                await this.say(
                    "error",
                    "Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
                )
                await this.context.addToApiConversationHistory({
                    role: "assistant",
                    content: [{ type: "text", text: "Failure: I did not provide a response." }],
                })
            }

            return didEndLoop // will always be false for now
        } catch (error) {
            // this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonClicked, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
            return true // needs to be true so parent loop knows to end task
        }
    }

}
