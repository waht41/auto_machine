import { Anthropic } from "@anthropic-ai/sdk"
import cloneDeep from "clone-deep"
import { DiffStrategy, getDiffStrategy } from "./diff/DiffStrategy"
import { ToolName, validateToolUse } from "./mode-validator"
import delay from "delay"
import fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { serializeError } from "serialize-error"
import { ApiHandler, buildApiHandler } from "@/api"
import { ApiStream, ApiStreamChunk } from "@/api/transform/stream"
import { DiffViewProvider } from "@/integrations/editor/DiffViewProvider"
import { findToolName, formatContentBlockToMarkdown } from "@/integrations/misc/export-markdown"
import { truncateOutput, } from "@/integrations/misc/extract-text"
import { TerminalManager } from "@/integrations/terminal/TerminalManager"
import { UrlContentFetcher } from "@/services/browser/UrlContentFetcher"
import { ApiConfiguration } from "@/shared/api"
import { findLastIndex } from "@/shared/array"
import { combineApiRequests } from "@/shared/combineApiRequests"
import { combineCommandSequences } from "@/shared/combineCommandSequences"
import {
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineMessage,
	ClineSay,
	ExtensionMessage,
} from "@/shared/ExtensionMessage"
import { getApiMetrics } from "@/shared/getApiMetrics"
import { HistoryItem } from "@/shared/HistoryItem"
import { ClineAskResponse } from "@/shared/WebviewMessage"
import { calculateApiCost } from "@/utils/cost"
import { fileExistsAtPath } from "@/utils/fs"
import { parseMentions } from "./mentions"
import { AssistantMessageContent, ToolUse, ToolUseName } from "./assistant-message"
import { formatResponse } from "./prompts/responses"
import { SYSTEM_PROMPT } from "./prompts/system"
import { defaultModeSlug } from "@/shared/modes"
import { truncateHalfConversation } from "./sliding-window"
import { ClineProvider, GlobalFileNames } from "./webview/ClineProvider"
import { BrowserSession } from "@/services/browser/BrowserSession"
import { McpHub } from "@operation/MCP"
import crypto from "crypto"
import { CommandRunner } from "@executors/runner";
import { parseBlocks } from "@core/assistant-message/parse-assistant-message";
import { registerInternalImplementation } from "@core/internal-implementation";
import process from "node:process";
import { toUserContent, UserContent } from "@core/prompts/utils";
import { Command, Middleware } from "@executors/types";

const cwd = process.cwd()

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>


const endHint = 'roo stop the conversion, should resume?';

interface IProp {
	provider: ClineProvider,
	apiConfiguration: ApiConfiguration,
	postMessageToWebview:  (message: ExtensionMessage) => Promise<void>,
	customInstructions?: string,
	enableDiff?: boolean,
	fuzzyMatchThreshold?: number,
	task?: string | undefined,
	images?: string[] | undefined,
	historyItem?: HistoryItem | undefined,
	experimentalDiffStrategy: boolean,
	middleWares?: Middleware[],
  mcpHub?: McpHub
}

export class Cline {
	readonly taskId: string
	api: ApiHandler
	private terminalManager: TerminalManager
	private urlContentFetcher: UrlContentFetcher
	private browserSession: BrowserSession
	private didEditFile: boolean = false
	customInstructions?: string
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number = 1.0

	apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = []
	clineMessages: ClineMessage[] = []
	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	private lastMessageTs?: number
	private consecutiveMistakeCount: number = 0
	private consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	private providerRef: WeakRef<ClineProvider>
	private abort: boolean = false
	didFinishAborting = false
	abandoned = false
	private diffViewProvider: DiffViewProvider
	private postMessageToWebview: (message: ExtensionMessage) => Promise<void>

	// streaming
	private currentStreamingContentIndex = 0
	private assistantMessageContent: AssistantMessageContent[] = []
	private presentAssistantMessageLocked = false
	private presentAssistantMessageHasPendingUpdates = false
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	private userMessageContentReady = false
	private didRejectTool = false
	private didGetNewMessage = false
	private didCompleteReadingStream = false


	private executor = new CommandRunner()
	private asking = false;
  private mcpHub?: McpHub

	constructor(
		prop: IProp
	) {
		const { provider, apiConfiguration, postMessageToWebview, customInstructions, enableDiff, fuzzyMatchThreshold, historyItem, experimentalDiffStrategy, middleWares = [], mcpHub } = prop
		this.postMessageToWebview = postMessageToWebview
		this.taskId = crypto.randomUUID()
		this.api = buildApiHandler(apiConfiguration)
		this.terminalManager = new TerminalManager()
		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.browserSession = new BrowserSession(provider.context)
		this.customInstructions = customInstructions
		this.diffEnabled = enableDiff ?? false
		this.fuzzyMatchThreshold = fuzzyMatchThreshold ?? 1.0
		this.providerRef = new WeakRef(provider)
		this.diffViewProvider = new DiffViewProvider(cwd)
    this.mcpHub = mcpHub
		registerInternalImplementation(this.executor)
		for (const middleware of middleWares) {
			this.executor.use(middleware)
		}

		if (historyItem) {
			this.taskId = historyItem.id
		}
		// Initialize diffStrategy based on current state
		this.updateDiffStrategy(experimentalDiffStrategy)
	}

	async start({task, images}: {task?: string, images?: string[]}) {
		if (!task && !images) {
			throw new Error("Either historyItem or task/images must be provided")
		}
		if (task || images) {
			this.startTask(task, images)
		}
	}

	async resume({text, images}: {text?: string, images?: string[]}) {
		if (!this.taskId){
			throw new Error("Task ID not set")
		}
		if (text || images) {
			this.resumeTaskWithNewMessage(text,images)
		}
		else {
			this.resumeTaskFromHistory()
		}
	}

	// Add method to update diffStrategy
	async updateDiffStrategy(experimentalDiffStrategy?: boolean) {
		// If not provided, get from current state
		if (experimentalDiffStrategy === undefined) {
			const { experimentalDiffStrategy: stateExperimentalDiffStrategy } =
				(await this.providerRef.deref()?.getState()) ?? {}
			experimentalDiffStrategy = stateExperimentalDiffStrategy ?? false
		}
		this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy)
	}

	// Storing task to disk for history

	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
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

	// Communicate with webview

	async askP({
				   askType,
				   text,
				   partial,
		replacing = false,
		noReturn = true
			   }: {
		askType: ClineAsk,
		text?: string,
		partial?: boolean,
		replacing?: boolean,
		noReturn?: boolean
	}) {
		return await this.ask(askType, text, partial, replacing, noReturn)
	}

	async ask(
		askType: ClineAsk,
		text?: string,
		partial?: boolean,
		replacing = false,
		noReturn = false
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted");
		}

		const lastMessage = this.clineMessages.at(-1)
		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && (lastMessage.ask === askType || replacing)
		let askTs: number | undefined;
		const handlePartialUpdate = async () => {
			if (isUpdatingPreviousPartial) {
				// existing partial message, so update it
				lastMessage.text = text
				lastMessage.partial = partial
				lastMessage.ask = askType
				lastMessage.say = undefined
				lastMessage.type = "ask"
				await this.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
				throw new Error("Current ask promise was ignored 1")
			} else {
				// this is a new partial message, so add it with partial state
				askTs = Date.now()
				this.lastMessageTs = askTs
				await this.addToClineMessages({ ts: askTs, type: "ask", ask: askType, text, partial })
				await this.providerRef.deref()?.postStateToWebview()
				throw new Error("Current ask promise was ignored 2")
			}
		};

		const handleCompletion = async () => {
			// partial=false means its a complete version of a previously partial message
			if (isUpdatingPreviousPartial) {
				this.resetAskState()

				/*
                Bug for the history books:
                In the webview we use the ts as the chatrow key for the virtuoso list. Since we would update this ts right at the end of streaming, it would cause the view to flicker. The key prop has to be stable otherwise react has trouble reconciling items between renders, causing unmounting and remounting of components (flickering).
                The lesson here is if you see flickering when rendering lists, it's likely because the key prop is not stable.
                So in this case we must make sure that the message ts is never altered after first setting it.
                */
				askTs = lastMessage.ts
				this.lastMessageTs = askTs
				lastMessage.ask = askType
				lastMessage.say = undefined
				lastMessage.type = "ask"
				lastMessage.text = text
				lastMessage.partial = false
				await this.saveClineMessages()
				await this.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })

			} else {
				await addNewAsk();
			}
		};

		const addNewAsk = async () => {
			// this is a new non-partial message, so add it like normal
			this.resetAskState()
			askTs = Date.now()
			this.lastMessageTs = askTs
			await this.addToClineMessages({ ts: askTs, type: "ask", ask: askType, text })
			await this.providerRef.deref()?.postStateToWebview()
		}

		if (partial !== undefined) {
			partial ?
				await handlePartialUpdate() :
				await handleCompletion();
		} else {
			await addNewAsk();
		}

		if (noReturn) {
			this.asking = true;
			//@ts-ignore
			return;
		}
		await this.waitForResponse(askTs);
		return this.getResponseResult();
	}

	private resetAskState() {
		this.askResponse = undefined;
		this.askResponseText = undefined;
		this.askResponseImages = undefined;
	}

	private async waitForResponse(ts?: number) {
		await pWaitFor(
			() => this.askResponse !== undefined || this.lastMessageTs !== ts,
			{ interval: 100 }
		);
		if (this.lastMessageTs !== ts) {
			throw new Error("Current ask promise was ignored");
		}
	}

	private getResponseResult() {
		const result = {
			response: this.askResponse!,
			text: this.askResponseText,
			images: this.askResponseImages
		};
		this.resetAskState();
		return result;
	}

	async handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	async sayP({
				   sayType,
				   text,
				   images,
				   partial,
				   replacing = false,
			   }: {
		sayType: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		replacing?: boolean
	}) {
		return await this.say(sayType, text, images, partial, replacing)
	}

	async say(sayType: ClineSay, text?: string, images?: string[], partial?: boolean, replacing = false): Promise<undefined> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted");
		}
		const lastMessage = this.clineMessages.at(-1);
		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && (lastMessage.say === sayType || replacing);

		const handlePartialUpdate = async () => {
			if (isUpdatingPreviousPartial) {
				// existing partial message, so update it
				lastMessage.type = "say";
				lastMessage.say = sayType;
				lastMessage.text = text;
				lastMessage.images = images;
				lastMessage.partial = true;
				await this.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage });
			} else {
				await addMessage(partial);
			}
		};

		const handleCompletion = async () => {
			if (isUpdatingPreviousPartial) {
				// this is the complete version of a previously partial message, so replace the partial with the complete version
				this.lastMessageTs = lastMessage.ts;
				lastMessage.type = "say";
				lastMessage.say = sayType;
				lastMessage.text = text;
				lastMessage.images = images;
				lastMessage.partial = false;

				// instead of streaming partialMessage events, we do a save and post like normal to persist to disk
				await this.saveClineMessages();
				await this.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage }); // more performant than an entire postStateToWebview
			} else {
				await addMessage();
			}
		};

		const addMessage = async (partial?:boolean) => {
			// this is a new non-partial message, so add it like normal
			const sayTs = Date.now();
			this.lastMessageTs = sayTs;
			await this.addToClineMessages({ ts: sayTs, type: "say", say: sayType, text, images, partial });
			await this.providerRef.deref()?.postStateToWebview();
		};

		if (partial !== undefined) {
			partial ? await handlePartialUpdate() : await handleCompletion();
		} else {
			await addMessage();
		}
	}

	async sayAndCreateMissingParamError(toolName: ToolUseName, paramName: string, relPath?: string) {
		await this.say(
			"error",
			`Roo tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ""
			} without value for required parameter '${paramName}'. Retrying...`,
		)
		return formatResponse.toolError(formatResponse.missingToolParameterError(paramName))
	}

	// Task lifecycle

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

	private async resumeTaskWithNewMessage(text?: string, images?: string[]) {
		this.clineMessages = await this.getSavedClineMessages()
		this.apiConversationHistory = await this.getSavedApiConversationHistory()
		if (this.clineMessages.at(-1)?.text === endHint) {
			this.clineMessages.pop();
		}
		await this.say("user_feedback", text, images, true)
		const userContent: UserContent = toUserContent(text, images)
		this.initiateTaskLoop(userContent)
	}

	async receiveAnswer({uuid, result, images}:
						{ uuid: string, result: string, images?: string[] })
	{
		if (!uuid) {
			throw new Error("No uuid provided for answer")
		}
		this.clineMessages = await this.getSavedClineMessages()
		this.apiConversationHistory = await this.getSavedApiConversationHistory()
		const length = this.clineMessages.length -1;
		for (let i = length ; i>=0 ; i--) {
			const clineMessage = this.clineMessages[i]
			if (clineMessage.type !== "ask") {
				continue
			}
			if (clineMessage.text === endHint) {
				this.clineMessages.splice(i, 1);
				continue;
			}
			if (clineMessage.text) {
				try {
					const command = JSON.parse(clineMessage.text)
					if (command.uuid === uuid) {
						command.result = result;
						clineMessage.text = JSON.stringify(command)
						// await this.overwriteClineMessages(this.clineMessages);
						break
					}
				} catch (error) {
					console.error("Failed to parse command from text:", error)
				}
			}
		}
		const userContent: UserContent = toUserContent(result, images)
		this.initiateTaskLoop(userContent)
	}

  private getInternalContext(replacing: boolean = false) {
    return {
      cline: this,
      mcpHub: this.mcpHub,
      replacing: replacing
    }
  }

	async receiveApproval({tool}:
						{ tool: any })
	{
		//todo waht 还没写完
		console.log('[waht]','receiveApproval', tool);
		const result = await this.applyCommand(tool,this.getInternalContext())
		this.resume({text: typeof result === 'string'? result: undefined, images: []})
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
		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent)

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
				console.log('[waht] 触发了no tool use')
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

	// Tools

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

	async *attemptApiRequest(previousApiReqIndex: number): ApiStream {
		let mcpHub: McpHub | undefined

		const { mcpEnabled, alwaysApproveResubmit, requestDelaySeconds } =
			(await this.providerRef.deref()?.getState()) ?? {}

		if (mcpEnabled ?? true) {
			mcpHub = this.providerRef.deref()?.mcpHub
			if (!mcpHub) {
				throw new Error("MCP hub not available")
			}
			// Wait for MCP servers to be connected before generating system prompt
			await pWaitFor(() => mcpHub!.isConnecting !== true, { timeout: 10_000 }).catch(() => {
				console.error("MCP servers failed to connect in time")
			})
		}

		const { browserViewportSize, mode, customModePrompts, preferredLanguage } =
			(await this.providerRef.deref()?.getState()) ?? {}
		const { customModes } = (await this.providerRef.deref()?.getState()) ?? {}
		const systemPrompt = await (async () => {
			const provider = this.providerRef.deref()
			if (!provider) {
				throw new Error("Provider not available")
			}
			return SYSTEM_PROMPT(
				provider.context,
				cwd,
				this.api.getModel().info.supportsComputerUse ?? false,
				mcpHub,
				this.diffStrategy,
				browserViewportSize,
				mode,
				customModePrompts,
				customModes,
				this.customInstructions,
				preferredLanguage,
				this.diffEnabled,
			)
		})()

		// If the previous API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
		if (previousApiReqIndex >= 0) {
			const previousRequest = this.clineMessages[previousApiReqIndex]
			if (previousRequest && previousRequest.text) {
				const { tokensIn, tokensOut, cacheWrites, cacheReads }: ClineApiReqInfo = JSON.parse(
					previousRequest.text,
				)
				const totalTokens = (tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0)
				const contextWindow = this.api.getModel().info.contextWindow || 128_000
				const maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
				if (totalTokens >= maxAllowedSize) {
					const truncatedMessages = truncateHalfConversation(this.apiConversationHistory)
					await this.overwriteApiConversationHistory(truncatedMessages)
				}
			}
		}

		// Clean conversation history by:
		// 1. Converting to Anthropic.MessageParam by spreading only the API-required properties
		// 2. Converting image blocks to text descriptions if model doesn't support images
		const cleanConversationHistory = this.apiConversationHistory.map(({ role, content }) => {
			// Handle array content (could contain image blocks)
			if (Array.isArray(content)) {
				if (!this.api.getModel().info.supportsImages) {
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
		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory)
		const iterator = stream[Symbol.asyncIterator]()

		try {
			// awaiting first chunk to see if it will throw an error
			const firstChunk = await iterator.next()
			yield firstChunk.value
		} catch (error) {
			// note that this api_req_failed ask is unique in that we only present this option if the api hasn't streamed any content yet (ie it fails on the first chunk due), as it would allow them to hit a retry button. However if the api failed mid-stream, it could be in any arbitrary state where some tools may have executed, so that error is handled differently and requires cancelling the task entirely.
			if (alwaysApproveResubmit) {
				const errorMsg = error.message ?? "Unknown error"
				console.error("API request failed:", errorMsg)
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

	async handleAssistantMessage(replacing = false) {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		if (this.presentAssistantMessageLocked) {
			this.presentAssistantMessageHasPendingUpdates = true
			return
		}
		this.presentAssistantMessageLocked = true
		this.presentAssistantMessageHasPendingUpdates = false

		if (this.currentStreamingContentIndex >= this.assistantMessageContent.length) {
			// this may happen if the last content block was completed before streaming could finish. if streaming is finished, and we're out of bounds then this means we already presented/executed the last content block and are ready to continue to next request
			if (this.didCompleteReadingStream) {
				this.userMessageContentReady = true
			}
			// console.log("no more content blocks to stream! this shouldn't happen?")
			this.presentAssistantMessageLocked = false
			return
			//throw new Error("No more content blocks to stream! This shouldn't happen...") // remove and just return after testing
		}

		const block = cloneDeep(this.assistantMessageContent[this.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too
		// console.log('[waht] present', block)
		switch (block.type) {
			case "text": {
				let content = block.content
				if (content) {
					// content = content.replace(/<thinking>\s?/g, "")
					// content = content.replace(/\s?<\/thinking>/g, "")
				}
				await this.say("text", content, undefined, block.partial, replacing)
				break
			}
			case "tool_use":
				if (block.partial){
					break
				}
				const toolDescription = () => {
					switch (block.name) {
						case "external":
							return `[${block.name} for '${block.params.request}']`
						case "file":
							return `[${block.name} for '${block.params.path}']`
						case "ask":
							return `[${block.name} for '${block.params.askType}']`
						default:
							return `[${block.name}]`
					}
				}

				const pushToolResult = (content: ToolResponse) => {
					this.userMessageContent.push({
						type: "text",
						text: `${toolDescription()} Result:`,
					})
					if (typeof content === "string") {
						this.userMessageContent.push({
							type: "text",
							text: content || "(tool did not return anything)",
						})
					} else {
						this.userMessageContent.push(...content)
					}
					const texts = this.userMessageContent.filter((block) => block.type === "text")
					const textStrings = texts.map((block) => block.text)
					this.say("text", textStrings.join('\n'), undefined, block.partial, replacing)
					// once a tool result has been collected, ignore all other tool uses since we should only ever present one tool result per message
					this.didGetNewMessage = true
				}

				const askApproval = async (type: ClineAsk, partialMessage?: string) => {
					const { response, text, images } = await this.ask(type, partialMessage, false)
					if (response !== "yesButtonClicked") {
						if (response === "messageResponse") {
							await this.say("user_feedback", text, images)
							pushToolResult(
								formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images),
							)
						} else {
							pushToolResult(formatResponse.toolDenied())
						}
						this.didRejectTool = true
						return false
					}
					return true
				}

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
					await this.say(
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)
					pushToolResult(formatResponse.toolError(errorString))
				}

				// if (block.name !== "browser_action") {
				// 	await this.browserSession.closeBrowser()
				// } //todo waht

				// Validate tool use before execution
				const { mode, customModes } = (await this.providerRef.deref()?.getState()) ?? {}
				try {
					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						{
							apply_diff: this.diffEnabled,
						},
						block.params,
					)
				} catch (error) {
					this.consecutiveMistakeCount++
					pushToolResult(formatResponse.toolError(error.message))
					console.error("Tool use validation error:", error)
					break
				}

				if (block.name === 'ask'){ // assign UUID to receive corresponding answers
					block.params.uuid = crypto.randomUUID();
				}

				try {
					const res = await this.applyToolUse(block, this.getInternalContext())
					if (typeof res === "string") {
						console.log('[waht] 执行tool 返回结果: ',res)
						pushToolResult(res)
					}
				} catch (e) {
					await handleError(`executing tool ${block.name}, `, e)
				}
		}

		/*
		Seeing out of bounds is fine, it means that the next too call is being built up and ready to add to assistantMessageContent to present.
		When you see the UI inactive during this, it means that a tool is breaking without presenting any UI. For example the write_to_file tool was breaking when relpath was undefined, and for invalid relpath it never presented UI.
		*/
		this.presentAssistantMessageLocked = false // this needs to be placed here, if not then calling this.presentAssistantMessage below would fail (sometimes) since it's locked
		// NOTE: when tool is rejected, iterator stream is interrupted and it waits for userMessageContentReady to be true. Future calls to present will skip execution since didRejectTool and iterate until contentIndex is set to message length and it sets userMessageContentReady to true itself (instead of preemptively doing it in iterator)
		if (!block.partial || this.didRejectTool) {
			// block is finished streaming and executing
			if (this.currentStreamingContentIndex === this.assistantMessageContent.length - 1) {
				// its okay that we increment if !didCompleteReadingStream, it'll just return bc out of bounds and as streaming continues it will call presentAssitantMessage if a new block is ready. if streaming is finished then we set userMessageContentReady to true when out of bounds. This gracefully allows the stream to continue on and all potential content blocks be presented.
				// last block is complete and it is finished executing
				this.userMessageContentReady = true // will allow pwaitfor to continue
			}

			// call next block if it exists (if not then read stream will call it when its ready)
			this.currentStreamingContentIndex++ // need to increment regardless, so when read stream calls this function again it will be streaming the next block

			if (this.currentStreamingContentIndex < this.assistantMessageContent.length) {
				// there are already more content blocks to stream, so we'll call this function ourselves
				// await this.presentAssistantContent()

				this.handleAssistantMessage()
				return
			}
		}
		// block is partial, but the read stream may have finished
		if (this.presentAssistantMessageHasPendingUpdates) {
			this.handleAssistantMessage()
		}
	}

	async applyToolUse(block: ToolUse, context?: any): Promise<any> {
		return await this.applyCommand({...block.params, type:block.name}, context)
	}

	async applyCommand(command: Command, context?: any): Promise<any> {
		console.log('[waht] try apply tool',command)
		if (this.executor.executorNames.includes(command.type)) {
			return await this.executor.runCommand(command, context) ?? 'no result return'
		}
		console.log('[waht]','no executor found for',command.type)
		return null;
	}

	private async handleMistakeLimit(userContent: UserContent) {
		if (this.consecutiveMistakeCount < 3) return;

		const { response, text, images } = await this.ask(
			"mistake_limit_reached",
			this.api.getModel().id.includes("claude")
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
		this.consecutiveMistakeCount = 0
	}

	async prepareUserContent(userContent: UserContent, lastApiReqIndex: number): Promise<UserContent> {
		const [parsedUserContent] = await this.loadContext(userContent)
		await this.addToApiConversationHistory({ role: "user", content: parsedUserContent })

		// since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
		this.clineMessages[lastApiReqIndex].text = JSON.stringify({
			request: parsedUserContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n"),
		} satisfies ClineApiReqInfo)
		await this.saveClineMessages()
		await this.providerRef.deref()?.postStateToWebview()

		return parsedUserContent
	}

	async handleAssistantMessageComplete(assistantMessage: string) {
		// now add to apiconversationhistory
		// need to save assistant responses to file before proceeding to tool use since user can exit at any moment and we wouldn't be able to save the assistant's response
		let didEndLoop = false
		if (assistantMessage.length > 0) {
			await this.addToApiConversationHistory({
				role: "assistant",
				content: [{ type: "text", text: assistantMessage }],
			})

			// NOTE: this comment is here for future reference - this was a workaround for userMessageContent not getting set to true. It was due to it not recursively calling for partial blocks when didRejectTool, so it would get stuck waiting for a partial block to complete before it could continue.
			// in case the content blocks finished
			// it may be the api stream finished after the last parsed content block was executed, so  we are able to detect out of bounds and set userMessageContentReady to true (note you should not call presentAssistantMessage since if the last block is completed it will be presented again)
			// const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // if there are any partial blocks after the stream ended we can consider them invalid
			// if (this.currentStreamingContentIndex >= completeBlocks.length) {
			// 	this.userMessageContentReady = true
			// }
			console.log('[waht] waiting for user message content ready', assistantMessage)
			await pWaitFor(() => this.userMessageContentReady)
			console.log('[waht] wait end')

			// if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
			// const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
			if (!this.didGetNewMessage) {
				// this.userMessageContent.push({
				// 	type: "text",
				// 	text: formatResponse.noToolsUsed(),
				// })
				await this.askP({
					askType: 'followup',
					text: endHint,
					partial: false,
					replacing: false,
					noReturn: true,
				})
				this.consecutiveMistakeCount++
				console.log('[waht] no new message get')
				return true;
			} else if (this.asking){
				console.log('[waht] asking')
				this.asking = false;
				return true;
			}
			else {
				didEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent)
			}
		} else {
			// if there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
			await this.say(
				"error",
				"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
			)
			await this.addToApiConversationHistory({
				role: "assistant",
				content: [{ type: "text", text: "Failure: I did not provide a response." }],
			})
		}

		return didEndLoop
	}

	updateApiReq (apiReq: ClineApiReqInfo, lastApiReqIndex: number) {
		this.clineMessages[lastApiReqIndex].text = JSON.stringify(apiReq)
	}

	private async abortStream  (cancelReason: ClineApiReqCancelReason, assistantMessage: string, apiReq:ClineApiReqInfo, lastApiReqIndex:number, streamingFailedMessage?: string){
		if (this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges() // closes diff view
		}

		// if last message is a partial we need to update and save it
		const lastMessage = this.clineMessages.at(-1)
		if (lastMessage && lastMessage.partial) {
			// lastMessage.ts = Date.now() DO NOT update ts since it is used as a key for virtuoso list
			lastMessage.partial = false
			// instead of streaming partialMessage events, we do a save and post like normal to persist to disk
			console.log("updating partial message", lastMessage)
			// await this.saveClineMessages()
		}

		// Let assistant know their response was interrupted for when task is resumed
		await this.addToApiConversationHistory({
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
		apiReq.cancelReason = cancelReason
		apiReq.streamingFailedMessage = streamingFailedMessage
		this.updateApiReq(apiReq, lastApiReqIndex)
		await this.saveClineMessages()

		// signals to provider that it can retrieve the saved messages from disk, as abortTask can not be awaited on in nature
		this.didFinishAborting = true
	}

	private async handleStreamError (error: Error, assistantMessage:string, apiReq:ClineApiReqInfo, lastApiReqIndex: number){
		console.error("error when receive chunk: ", error)
		// abandoned happens when extension is no longer waiting for the cline instance to finish aborting (error is thrown here when any function in the for loop throws due to this.abort)
		if (!this.abandoned) {
			this.abortTask() // if the stream failed, there's various states the task could be in (i.e. could have streamed some tools the user may have executed), so we just resort to replicating a cancel task
			await this.abortStream(
				"streaming_failed",
				assistantMessage,
				apiReq,
				lastApiReqIndex,
				error.message ?? JSON.stringify(serializeError(error), null, 2),
			)
			const history = await this.providerRef.deref()?.getTaskWithId(this.taskId)
			if (history) {
				await this.providerRef.deref()?.initClineWithHistoryItem(history.historyItem)
				// await this.providerRef.deref()?.postStateToWebview()
			}
		}
	}

	private async resetStream() {
		// reset streaming state
		this.currentStreamingContentIndex = 0
		this.assistantMessageContent = []
		this.didCompleteReadingStream = false
		this.userMessageContent = []
		this.userMessageContentReady = false
		this.didRejectTool = false
		this.didGetNewMessage = false
		this.presentAssistantMessageLocked = false
		this.presentAssistantMessageHasPendingUpdates = false
		await this.diffViewProvider.reset()
	}

	async handleChunk(chunk: ApiStreamChunk, apiReq:ClineApiReqInfo, reasoningMessage: string, assistantMessage: string) {
		switch (chunk.type) {
			case "reasoning":
				reasoningMessage += chunk.text
				await this.say("reasoning", reasoningMessage, undefined, true)
				break
			case "usage":  //todo waht 不确定其它api回的是不是最终结果（腾讯云是）

				apiReq.tokensIn = chunk.inputTokens
				apiReq.tokensOut = chunk.outputTokens
				apiReq.cacheWrites = chunk.cacheWriteTokens ?? 0
				apiReq.cacheReads = chunk.cacheReadTokens ?? 0
				apiReq.cost = chunk.totalCost
				break
			case "text":
				assistantMessage += chunk.text
				console.log("返回的信息: ", chunk.text)
				// parse raw assistant message into content blocks
				const prevLength = this.assistantMessageContent.length
				this.assistantMessageContent = parseBlocks(assistantMessage)
				const replacing = this.assistantMessageContent.length <= prevLength
				if (this.assistantMessageContent.length > prevLength) {
					this.userMessageContentReady = false // new content we need to present, reset to false in case previous content set this to true
				}
				// present content to user
				this.handleAssistantMessage(replacing)
				break
		}
		return {reasoningMessage, assistantMessage}
	}

	async handleStreamingMessage(previousApiReqIndex: number, lastApiReqIndex: number) {

		const apiReq: ClineApiReqInfo = JSON.parse(this.clineMessages[lastApiReqIndex].text || "{}")
		apiReq.tokensIn = 0
		apiReq.tokensOut = 0
		apiReq.cacheWrites = 0
		apiReq.cacheReads = 0

		await this.resetStream()

		const stream = this.attemptApiRequest(previousApiReqIndex) // yields only if the first chunk is successful, otherwise will allow the user to retry the request (most likely due to rate limit error, which gets thrown on the first chunk)
		let assistantMessage = ""
		let reasoningMessage = ""
		try {
			for await (const chunk of stream) {
				const prop = await this.handleChunk(chunk, apiReq, reasoningMessage, assistantMessage)
				reasoningMessage = prop.reasoningMessage
				assistantMessage = prop.assistantMessage

				apiReq.cost = apiReq.cost ??
					calculateApiCost(this.api.getModel().info, apiReq.tokensIn, apiReq.tokensOut, apiReq.cacheWrites, apiReq.cacheReads)

				if (this.abort) {
					console.log("aborting stream...")
					if (!this.abandoned) {
						// only need to gracefully abort if this instance isn't abandoned (sometimes openrouter stream hangs, in which case this would affect future instances of cline)
						await this.abortStream("user_cancelled",assistantMessage,apiReq,lastApiReqIndex)
					}
					break // aborts the stream
				}

				if (this.didRejectTool) {
					// userContent has a tool rejection, so interrupt the assistant's response to present the user's feedback
					assistantMessage += "\n\n[Response interrupted by user feedback]"
					// this.userMessageContentReady = true // instead of setting this premptively, we allow the present iterator to finish and set userMessageContentReady when its ready
					break
				}

			}
		} catch (error) {
			await this.handleStreamError(error, assistantMessage, apiReq, lastApiReqIndex)
		}

		// need to call here in case the stream was aborted
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		this.didCompleteReadingStream = true

		// set any blocks to be complete to allow presentAssistantMessage to finish and set userMessageContentReady to true
		// (could be a text block that had no subsequent tool uses, or a text block at the very end, or an invalid tool use, etc. whatever the case, presentAssistantMessage relies on these blocks either to be completed or the user to reject a block in order to proceed and eventually set userMessageContentReady to true)
		const partialBlocks = this.assistantMessageContent.filter((block) => block.partial)
		partialBlocks.forEach((block) => {
			block.partial = false
		})
		if (partialBlocks.length > 0) {
			await this.handleAssistantMessage() // if there is content to update then it will complete and update this.userMessageContentReady to true, which we pwaitfor before making the next request. all this is really doing is presenting the last partial message that we just set to complete
		}

		this.updateApiReq(apiReq, lastApiReqIndex)
		await this.saveClineMessages()
		await this.providerRef.deref()?.postStateToWebview()

		return this.handleAssistantMessageComplete(assistantMessage);
	}

	async recursivelyMakeClineRequests(
		userContent: UserContent,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		await this.handleMistakeLimit(userContent)

		// get previous api req's index to check token usage and determine if we need to truncate conversation history
		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")

		// getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
		// for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
		await this.say(
			"api_req_started",
			JSON.stringify({
				request:
					userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n") + "\n\nLoading...",
			}),
		)

		const lastApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")

		await this.prepareUserContent(userContent, lastApiReqIndex)

		try {
			return this.handleStreamingMessage(previousApiReqIndex, lastApiReqIndex)
		} catch (error) {
			console.error("Error in recursivelyMakeClineRequests:", error)
			// this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonClicked, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
			return true // needs to be true so parent loop knows to end task
		}
	}

	async loadContext(userContent: UserContent) {
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
		])
	}

}

