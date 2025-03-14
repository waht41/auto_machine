import { Anthropic } from '@anthropic-ai/sdk';
import { DiffStrategy, getDiffStrategy } from './diff/DiffStrategy';
import pWaitFor from 'p-wait-for';
import * as path from 'path';
import { serializeError } from 'serialize-error';
import { ApiHandler, buildApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { DiffViewProvider } from '@/integrations/editor/DiffViewProvider';
import { formatContentBlockToMarkdown } from '@/integrations/misc/export-markdown';
import { TerminalManager } from '@/integrations/terminal/TerminalManager';
import { UrlContentFetcher } from '@/services/browser/UrlContentFetcher';
import { ApiConfiguration } from '@/shared/api';
import { findLastIndex } from '@/shared/array';
import { combineApiRequests } from '@/shared/combineApiRequests';
import { combineCommandSequences } from '@/shared/combineCommandSequences';
import {
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineMessage,
	ClineSay,
	ExtensionMessage,
} from '@/shared/ExtensionMessage';
import { getApiMetrics } from '@/shared/getApiMetrics';
import { HistoryItem } from '@/shared/HistoryItem';
import { ClineAskResponse } from '@/shared/WebviewMessage';
import { parseMentions } from './mentions';
import { ToolUse, ToolUseName } from './assistant-message';
import { formatResponse } from './prompts/responses';
import { truncateHalfConversation } from './sliding-window';
import { ClineProvider } from './webview/ClineProvider';
import { BrowserSession } from '@/services/browser/BrowserSession';
import { McpHub } from '@operation/MCP';
import crypto from 'crypto';
import { CommandRunner } from '@executors/runner';
import { registerInternalImplementation } from '@core/internal-implementation';
import process from 'node:process';
import { toUserContent, UserContent } from '@core/prompts/utils';
import { Command, Middleware } from '@executors/types';
import { StreamChatManager } from '@core/manager/StreamChatManager';
import { IApiConversationHistory } from '@core/manager/type';
import { IInternalContext } from '@core/internal-implementation/type';
import { ProcessingState } from '@core/handlers/type';
import { BlockProcessHandler } from '@core/handlers/BlockProcessHandler';

const cwd = process.cwd();

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

interface IProp {
	provider: ClineProvider,
	apiConfiguration: ApiConfiguration,
	postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
	customInstructions?: string,
	enableDiff?: boolean,
	fuzzyMatchThreshold?: number,
	task?: string | undefined,
	images?: string[] | undefined,
	historyItem?: HistoryItem | undefined,
	experimentalDiffStrategy: boolean,
	middleWares?: Middleware[],
	mcpHub?: McpHub
	taskParentDir: string
}

export class Cline {
	readonly taskId: string;
	api: ApiHandler;
	private terminalManager: TerminalManager;
	private urlContentFetcher: UrlContentFetcher;
	private browserSession: BrowserSession;
	private didEditFile: boolean = false;
	customInstructions?: string;
	diffStrategy?: DiffStrategy;
	diffEnabled: boolean = false;
	fuzzyMatchThreshold: number = 1.0;

	private readonly taskDir: string;

	private askResponse?: ClineAskResponse;
	private askResponseText?: string;
	private askResponseImages?: string[];
	private lastMessageTs?: number;
	private consecutiveMistakeCount: number = 0;
	private providerRef: WeakRef<ClineProvider>;
	private abort: boolean = false;
	didFinishAborting = false;
	abandoned = false;
	private diffViewProvider: DiffViewProvider;
	private postMessageToWebview: (message: ExtensionMessage) => Promise<void>;

	// streaming
	private blockProcessHandler = new BlockProcessHandler();
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
	private isThisStreamEnd = false;
	private didRejectTool = false;
	private didGetNewMessage = false;

	private executor = new CommandRunner();
	private asking = false;
	private mcpHub?: McpHub;
	private streamChatManager: StreamChatManager;

	constructor(
		prop: IProp
	) {
		const {
			provider,
			apiConfiguration,
			postMessageToWebview,
			customInstructions,
			enableDiff,
			fuzzyMatchThreshold,
			historyItem,
			experimentalDiffStrategy,
			middleWares = [],
			mcpHub,
			taskParentDir
		} = prop;
		this.postMessageToWebview = postMessageToWebview;
		this.taskId = historyItem ? historyItem.id : crypto.randomUUID();
		this.api = buildApiHandler(apiConfiguration);
		this.terminalManager = new TerminalManager();
		this.urlContentFetcher = new UrlContentFetcher(provider.context);
		this.browserSession = new BrowserSession(provider.context);
		this.customInstructions = customInstructions;
		this.diffEnabled = enableDiff ?? false;
		this.fuzzyMatchThreshold = fuzzyMatchThreshold ?? 1.0;
		this.providerRef = new WeakRef(provider);
		this.diffViewProvider = new DiffViewProvider(cwd);
		this.mcpHub = mcpHub;
		this.taskDir = path.join(taskParentDir, this.taskId);
		this.streamChatManager = new StreamChatManager(this.api, this.taskDir);
		registerInternalImplementation(this.executor);
		for (const middleware of middleWares) {
			this.executor.use(middleware);
		}


		// Initialize diffStrategy based on current state
		this.updateDiffStrategy(experimentalDiffStrategy);
	}

	async start({task, images}: { task?: string, images?: string[] }) {
		if (!task && !images) {
			throw new Error('Either historyItem or task/images must be provided');
		}
		if (task || images) {
			this.startTask(task, images);
		}
	}

	async resume({text, images}: { text?: string, images?: string[] }) {
		if (!this.taskId) {
			throw new Error('Task ID not set');
		}
		if (text || images) {
			this.resumeTaskWithNewMessage(text, images);
		} else {
			// this.resumeTaskFromHistory();
		}
	}

	// Add method to update diffStrategy
	async updateDiffStrategy(experimentalDiffStrategy?: boolean) {
		// If not provided, get from current state
		if (experimentalDiffStrategy === undefined) {
			const {experimentalDiffStrategy: stateExperimentalDiffStrategy} =
			(await this.providerRef.deref()?.getState()) ?? {};
			experimentalDiffStrategy = stateExperimentalDiffStrategy ?? false;
		}
		this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy);
	}

	get apiConversationHistory(): IApiConversationHistory {
		return this.streamChatManager.apiConversationHistory;
	}

	private set apiConversationHistory(value: IApiConversationHistory) {
		this.streamChatManager.apiConversationHistory = value;
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		await this.streamChatManager.addToApiConversationHistory(message);
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		await this.streamChatManager.overwriteApiConversationHistory(newHistory);
	}

	public get clineMessages(): ClineMessage[] {
		return this.streamChatManager.clineMessages;
	}

	public set clineMessages(value: ClineMessage[]) {
		this.streamChatManager.clineMessages = value;
	}

	async getSavedClineMessages(): Promise<ClineMessage[]> {
		return await this.streamChatManager.getSavedClineMessages();
	}

	private async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message);
		await this.saveClineMessages();
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages;
		await this.saveClineMessages();
	}

	private async saveClineMessages() {
		try {
			await this.streamChatManager.saveClineMessages();
			await this.postTaskHistory();
		} catch (error) {
			console.error('Failed to save cline messages:', error);
		}
	}

	private async postTaskHistory() {
		// combined as they are in ChatView
		const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))));
		const taskMessage = this.clineMessages[0]; // first message is always the task say
		const lastRelevantMessage =
			this.clineMessages[
				findLastIndex(
					this.clineMessages,
					(m) => !(m.ask === 'resume_task' || m.ask === 'resume_completed_task'),
				)
			];
		await this.providerRef.deref()?.updateTaskHistory({
			id: this.taskId,
			ts: lastRelevantMessage.ts,
			task: taskMessage.text ?? '',
			tokensIn: apiMetrics.totalTokensIn,
			tokensOut: apiMetrics.totalTokensOut,
			cacheWrites: apiMetrics.totalCacheWrites,
			cacheReads: apiMetrics.totalCacheReads,
			totalCost: apiMetrics.totalCost,
		});
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
		return await this.ask(askType, text, partial, replacing, noReturn);
	}

	async ask(
		askType: ClineAsk,
		text?: string,
		partial?: boolean,
		replacing = false,
		noReturn = false
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

		const lastMessage = this.clineMessages.at(-1);
		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && (lastMessage.ask === askType || replacing);
		let askTs: number | undefined;
		const handlePartialUpdate = async () => {
			if (isUpdatingPreviousPartial) {
				// existing partial message, so update it
				lastMessage.text = text;
				lastMessage.partial = partial;
				lastMessage.ask = askType;
				lastMessage.say = undefined;
				lastMessage.type = 'ask';
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage});
				throw new Error('Current ask promise was ignored 1');
			} else {
				// this is a new partial message, so add it with partial state
				askTs = Date.now();
				this.lastMessageTs = askTs;
				await this.addToClineMessages({ts: askTs, type: 'ask', ask: askType, text, partial});
				await this.providerRef.deref()?.postStateToWebview();
				throw new Error('Current ask promise was ignored 2');
			}
		};

		const handleCompletion = async () => {
			// partial=false means its a complete version of a previously partial message
			if (isUpdatingPreviousPartial) {
				this.resetAskState();

				/*
                Bug for the history books:
                In the webview we use the ts as the chatrow key for the virtuoso list. Since we would update this ts right at the end of streaming, it would cause the view to flicker. The key prop has to be stable otherwise react has trouble reconciling items between renders, causing unmounting and remounting of components (flickering).
                The lesson here is if you see flickering when rendering lists, it's likely because the key prop is not stable.
                So in this case we must make sure that the message ts is never altered after first setting it.
                */
				askTs = lastMessage.ts;
				this.lastMessageTs = askTs;
				lastMessage.ask = askType;
				lastMessage.say = undefined;
				lastMessage.type = 'ask';
				lastMessage.text = text;
				lastMessage.partial = false;
				await this.saveClineMessages();
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage});

			} else {
				await addNewAsk();
			}
		};

		const addNewAsk = async () => {
			// this is a new non-partial message, so add it like normal
			this.resetAskState();
			askTs = Date.now();
			this.lastMessageTs = askTs;
			await this.addToClineMessages({ts: askTs, type: 'ask', ask: askType, text});
			await this.providerRef.deref()?.postStateToWebview();
		};

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
			{interval: 100}
		);
		if (this.lastMessageTs !== ts) {
			throw new Error('Current ask promise was ignored');
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
		this.askResponse = askResponse;
		this.askResponseText = text;
		this.askResponseImages = images;
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
		return await this.say(sayType, text, images, partial, replacing);
	}

	async say(sayType: ClineSay, text?: string, images?: string[], partial?: boolean, replacing = false): Promise<undefined> {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}
		const lastMessage = this.clineMessages.at(-1);
		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && (lastMessage.say === sayType || replacing);

		const updateLastMessage = () => {
			const lastMessage = this.clineMessages.at(-1);
			if (!lastMessage) return;
			lastMessage.type = 'say';
			lastMessage.say = sayType;
			lastMessage.text = text;
			lastMessage.images = images;
			lastMessage.partial = partial;
		};

		const handlePartialUpdate = async () => {
			if (isUpdatingPreviousPartial) {
				// existing partial message, so update it
				updateLastMessage();
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage});
			} else {
				await addMessage(partial);
			}
		};

		const handleCompletion = async () => {
			if (isUpdatingPreviousPartial) {
				// this is the complete version of a previously partial message, so replace the partial with the complete version
				updateLastMessage();

				// instead of streaming partialMessage events, we do a save and post like normal to persist to disk
				await this.saveClineMessages();
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage}); // more performant than an entire postStateToWebview
			} else {
				await addMessage();
			}
		};

		const addMessage = async (partial?: boolean) => {
			// this is a new non-partial message, so add it like normal
			const sayTs = Date.now();
			this.lastMessageTs = sayTs;
			await this.addToClineMessages({ts: sayTs, type: 'say', say: sayType, text, images, partial});
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
			'error',
			`Roo tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ''
			} without value for required parameter '${paramName}'. Retrying...`,
		);
		return formatResponse.toolError(formatResponse.missingToolParameterError(paramName));
	}

	// Task lifecycle

	private async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (for API) and clineMessages (for webview) need to be in sync
		// if the extension process were killed, then on restart the clineMessages might not be empty, so we need to set it to [] when we create a new Cline client (otherwise webview would show stale messages from previous session)
		this.clineMessages = [];
		this.apiConversationHistory = [];
		await this.providerRef.deref()?.postStateToWebview();

		await this.say('text', task, images);

		const imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images);
		await this.initiateTaskLoop([
			{
				type: 'text',
				text: `<task>\n${task}\n</task>`,
			},
			...imageBlocks,
		]);
	}

	private async resumeTaskWithNewMessage(text?: string, images?: string[]) {
		await this.streamChatManager.resumeHistory();
		await this.say('user_feedback', text, images, true);
		const userContent: UserContent = toUserContent(text, images);
		this.initiateTaskLoop(userContent);
	}

	async receiveAnswer({uuid, result, images}: { uuid: string; result: string; images?: string[] }) {
		if (!uuid) {
			throw new Error('No uuid provided for answer');
		}
		await this.streamChatManager.resumeHistory();
		await this.updateAskMessageByUuid(uuid, result);
		this.initiateTaskLoop(toUserContent(result, images));
	}

	private async updateAskMessageByUuid(uuid: string, result: string): Promise<boolean> {
		const targetIndex = this.findLastAskMessageIndex(uuid);

		if (targetIndex === -1) {
			console.warn(`No matching message for UUID: ${uuid}`);
			return false;
		}

		const message = this.clineMessages[targetIndex];
		const command = this.parseMessageCommand(message.text) as { uuid: string; result?: string };

		if (!command) {
			console.error(`Invalid command format in message: ${message.text}`);
			return false;
		}

		command.result = result;
		message.text = JSON.stringify(command);
		// await this.overwriteClineMessages(this.clineMessages);  // 按需启用持久化
		return true;
	}

	private findLastAskMessageIndex(uuid: string): number {
		for (let i = this.clineMessages.length - 1; i >= 0; i--) {
			const message = this.clineMessages[i];
			if (message.type !== 'ask') continue;

			const command = this.parseMessageCommand(message.text) as { uuid: string };
			if (command?.uuid === uuid) return i;
		}
		return -1;
	}

	private parseMessageCommand(text?: string): unknown | null {
		try {
			return text ? JSON.parse(text) : null;
		} catch (error) {
			console.error('Failed to parse message text:', text?.substring(0, 50), error);
			return null;
		}
	}

	private getInternalContext(replacing: boolean = false): IInternalContext {
		return {
			cline: this,
			mcpHub: this.mcpHub,
			replacing: replacing
		};
	}

	async receiveApproval({tool}: { tool: Command }) {
		const result = await this.applyCommand(tool, this.getInternalContext());
		this.resume({text: typeof result === 'string' ? result : undefined, images: []});
	}

	private async initiateTaskLoop(userContent: UserContent): Promise<void> {
		let nextUserContent = userContent;
		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent);

			//  The way this agentic loop works is that cline will be given a task that he then calls tools to complete. unless there's an attempt_completion call, we keep responding back to him with his tool's responses until he either attempt_completion or does not use anymore tools. If he does not use anymore tools, we ask him to consider if he's completed the task and then call attempt_completion, otherwise proceed with completing the task.
			// There is a MAX_REQUESTS_PER_TASK limit to prevent infinite requests, but Cline is prompted to finish the task as efficiently as he can.

			//const totalCost = this.calculateApiCost(totalInputTokens, totalOutputTokens)
			if (didEndLoop) {
				// For now a task never 'completes'. This will only happen if the user hits max requests and denies resetting the count.
				//this.say("task_completed", `Task completed. Total API usage cost: ${totalCost}`)
				break;
			} else {
				// this.say(
				// 	"tool",
				// 	"Cline responded with only text blocks but has not called attempt_completion yet. Forcing him to continue with task..."
				// )
				console.log('[waht] 触发了no tool use');
				nextUserContent = [
					{
						type: 'text',
						text: '上一轮消息结束',
					},
				];
				this.consecutiveMistakeCount++;
			}
		}
	}

	abortTask() {
		this.abort = true; // will stop any autonomously running promises
		this.terminalManager.disposeAll();
		this.urlContentFetcher.closeBrowser();
		this.browserSession.closeBrowser();
	}

	async attemptApiRequest(previousApiReqIndex: number): Promise<ApiStream> {
		let mcpHub: McpHub | undefined;

		const {mcpEnabled} =
		(await this.providerRef.deref()?.getState()) ?? {};

		if (mcpEnabled ?? true) {
			mcpHub = this.providerRef.deref()?.mcpHub;
			if (!mcpHub) {
				throw new Error('MCP hub not available');
			}
			// Wait for MCP servers to be connected before generating system prompt
			await pWaitFor(() => !mcpHub!.isConnecting, {timeout: 10_000}).catch(() => {
				console.error('MCP servers failed to connect in time');
			});
		}

		// If the previous API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
		if (previousApiReqIndex >= 0) {
			const previousRequest = this.clineMessages[previousApiReqIndex];
			if (previousRequest && previousRequest.text) {
				const {tokensIn, tokensOut, cacheWrites, cacheReads}: ClineApiReqInfo = JSON.parse(
					previousRequest.text,
				);
				const totalTokens = (tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0);
				const contextWindow = this.api.getModel().info.contextWindow || 128_000;
				const maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8);
				if (totalTokens >= maxAllowedSize) {
					const truncatedMessages = truncateHalfConversation(this.apiConversationHistory);
					await this.overwriteApiConversationHistory(truncatedMessages);
				}
			}
		}

		return this.streamChatManager.attemptApiRequest();
	}

	async handleAssistantMessage(replacing = false) {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

		if (this.blockProcessHandler.checkProcessingLock()) {
			return;
		}
		this.blockProcessHandler.lockProcessing();
		const blockPositionState = this.blockProcessHandler.getBlockPositionState();

		if (blockPositionState.overLimit) {
			// this may happen if the last content block was completed before streaming could finish.
			// if streaming is finished, and we're out of bounds then this means
			// we already presented/executed the last content block and are ready to continue to next request
			if (this.streamChatManager.isStreamComplete()) {
				this.isThisStreamEnd = true;
			}
			this.blockProcessHandler.unlockPresentAssistantMessage();
			return;
		}

		// need to create copy bc while stream is updating the array, it could be updating the reference block properties too
		const block = this.blockProcessHandler.getCurrentBlock();
		switch (block.type) {
			case 'text': {
				const content = block.content;
				await this.say('text', content, undefined, block.partial, replacing);
				break;
			}
			case 'tool_use':
				if (block.partial) {
					break;
				}
				const toolDescription = () => {
					switch (block.name) {
						case 'external':
							return `[${block.name} for '${block.params.request}']`;
						case 'file':
							return `[${block.name} for '${block.params.path}']`;
						case 'ask':
							return `[${block.name} for '${block.params.askType}']`;
						default:
							return `[${block.name}]`;
					}
				};

				const pushToolResult = (content: ToolResponse) => {
					this.userMessageContent.push({
						type: 'text',
						text: `${toolDescription()} Result:`,
					});
					if (typeof content === 'string') {
						this.userMessageContent.push({
							type: 'text',
							text: content || '(tool did not return anything)',
						});
					} else {
						this.userMessageContent.push(...content);
					}
					const texts = this.userMessageContent.filter((block) => block.type === 'text');
					const textStrings = texts.map((block) => block.text);
					this.say('text', textStrings.join('\n'), undefined, block.partial, replacing);
					// once a tool result has been collected, ignore all other tool uses since we should only ever present one tool result per message
					this.didGetNewMessage = true;
				};

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`;
					await this.say(
						'error',
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					);
					pushToolResult(formatResponse.toolError(errorString));
				};

				// Validate tool use before execution todo waht 之后可能需要加上验证功能
				// const {mode, customModes} = (await this.providerRef.deref()?.getState()) ?? {};
				// try {
				// 	validateToolUse(
				// 		block.name as ToolName,
				// 		mode ?? defaultModeSlug,
				// 		customModes ?? [],
				// 		{
				// 			apply_diff: this.diffEnabled,
				// 		},
				// 		block.params,
				// 	);
				// } catch (error) {
				// 	this.consecutiveMistakeCount++;
				// 	pushToolResult(formatResponse.toolError(error.message));
				// 	console.error('Tool use validation error:', error);
				// 	break;
				// }

				if (block.name === 'ask') { // assign UUID to receive corresponding answers
					block.params.uuid = crypto.randomUUID();
				}

				try {
					const res = await this.applyToolUse(block, this.getInternalContext());
					if (typeof res === 'string') {
						console.log('[waht] 执行tool 返回结果: ', res);
						pushToolResult(res);
					}
				} catch (e) {
					await handleError(`executing tool ${block.name}, `, e);
				}
		}

		const isThisBlockFinished = !block.partial || this.didRejectTool;
		this.blockProcessHandler.unlockProcessing(isThisBlockFinished);

		if (isThisBlockFinished && blockPositionState.last) {
			// its okay that we increment if !didCompleteReadingStream, it'll just return bc out of bounds and as streaming continues it will call presentAssitantMessage if a new block is ready. if streaming is finished then we set isThisStreamEnd to true when out of bounds. This gracefully allows the stream to continue on and all potential content blocks be presented.
			// last block is complete and it is finished executing
			this.isThisStreamEnd = true; // will allow pwaitfor to continue
		}

		const shouldContinue = this.blockProcessHandler.shouldContinueProcessing(isThisBlockFinished);
		if (shouldContinue) {
			this.handleAssistantMessage();
		}
	}

	async applyToolUse(block: ToolUse, context?: IInternalContext): Promise<string | unknown> {
		return await this.applyCommand({...block.params, type: block.name}, context);
	}

	async applyCommand(command: Command, context?: IInternalContext): Promise<string | null> {
		console.log('[waht] try apply tool', command);
		if (this.executor.executorNames.includes(command.type)) {
			return await this.executor.runCommand(command, context) as string ?? 'no result return';
		}
		console.log('[waht]', 'no executor found for', command.type);
		return null;
	}

	private async handleMistakeLimit(userContent: UserContent) {
		if (this.consecutiveMistakeCount < 3) return;

		const {response, text, images} = await this.ask(
			'mistake_limit_reached',
			this.api.getModel().id.includes('claude')
				? 'This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").'
				: 'Roo Code uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it\'s recommended to use Claude 3.5 Sonnet for its advanced agentic coding capabilities.',
		);
		if (response === 'messageResponse') {
			userContent.push(
				...[
					{
						type: 'text',
						text: formatResponse.tooManyMistakes(text),
					} as Anthropic.Messages.TextBlockParam,
					...formatResponse.imageBlocks(images),
				],
			);
		}
		this.consecutiveMistakeCount = 0;
	}

	async prepareUserContent(userContent: UserContent, lastApiReqIndex: number): Promise<UserContent> {
		const [parsedUserContent] = await this.loadContext(userContent);
		await this.addToApiConversationHistory({role: 'user', content: parsedUserContent});

		// since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
		this.clineMessages[lastApiReqIndex].text = JSON.stringify({
			request: parsedUserContent.map((block) => formatContentBlockToMarkdown(block)).join('\n\n'),
		} satisfies ClineApiReqInfo);
		await this.saveClineMessages();
		await this.providerRef.deref()?.postStateToWebview();

		return parsedUserContent;
	}

	async handleAssistantMessageComplete(assistantMessage: string) {
		// now add to apiconversationhistory
		// need to save assistant responses to file before proceeding to tool use since user can exit at any moment and we wouldn't be able to save the assistant's response
		let didEndLoop = false;
		if (assistantMessage.length > 0) {
			await this.addToApiConversationHistory({
				role: 'assistant',
				content: [{type: 'text', text: assistantMessage}],
			});

			// NOTE: this comment is here for future reference - this was a workaround for userMessageContent not getting set to true. It was due to it not recursively calling for partial blocks when didRejectTool, so it would get stuck waiting for a partial block to complete before it could continue.
			// in case the content blocks finished
			// it may be the api stream finished after the last parsed content block was executed, so  we are able to detect out of bounds and set isThisStreamEnd to true (note you should not call presentAssistantMessage since if the last block is completed it will be presented again)
			// const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // if there are any partial blocks after the stream ended we can consider them invalid
			// if (this.currentStreamingContentIndex >= completeBlocks.length) {
			// 	this.isThisStreamEnd = true
			// }
			await pWaitFor(() => this.isThisStreamEnd);

			// if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
			// const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
			if (!this.didGetNewMessage) {
				await this.askP({
					askType: 'followup',
					text: this.streamChatManager.endHint,
					partial: false,
					replacing: false,
					noReturn: true,
				});
				this.consecutiveMistakeCount++;
				return true;
			} else if (this.asking) {
				this.asking = false;
				return true; // 不管asking，直接返回
			} else {
				didEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent);
			}
		} else {
			// if there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
			await this.say(
				'error',
				'Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model\'s output.',
			);
			await this.addToApiConversationHistory({
				role: 'assistant',
				content: [{type: 'text', text: 'Failure: I did not provide a response.'}],
			});
		}

		return didEndLoop;
	}

	updateApiReq(apiReq: ClineApiReqInfo, lastApiReqIndex: number) {
		this.clineMessages[lastApiReqIndex].text = JSON.stringify(apiReq);
	}

	private async abortStream(cancelReason: ClineApiReqCancelReason, assistantMessage: string, apiReq: ClineApiReqInfo, lastApiReqIndex: number, streamingFailedMessage?: string) {
		if (this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges(); // closes diff view
		}

		// if last message is a partial we need to update and save it
		const lastMessage = this.clineMessages.at(-1);
		if (lastMessage && lastMessage.partial) {
			// lastMessage.ts = Date.now() DO NOT update ts since it is used as a key for virtuoso list
			lastMessage.partial = false;
			// instead of streaming partialMessage events, we do a save and post like normal to persist to disk
			console.log('updating partial message', lastMessage);
			// await this.saveClineMessages()
		}

		// Let assistant know their response was interrupted for when task is resumed
		await this.addToApiConversationHistory({
			role: 'assistant',
			content: [
				{
					type: 'text',
					text:
						assistantMessage +
						`\n\n[${
							cancelReason === 'streaming_failed'
								? 'Response interrupted by API Error'
								: 'Response interrupted by user'
						}]`,
				},
			],
		});

		// update api_req_started to have cancelled and cost, so that we can display the cost of the partial stream
		apiReq.cancelReason = cancelReason;
		apiReq.streamingFailedMessage = streamingFailedMessage;
		this.updateApiReq(apiReq, lastApiReqIndex);
		await this.saveClineMessages();

		// signals to provider that it can retrieve the saved messages from disk, as abortTask can not be awaited on in nature
		this.didFinishAborting = true;
	}

	private async handleStreamError(error: Error, assistantMessage: string, apiReq: ClineApiReqInfo, lastApiReqIndex: number) {
		console.error('error when receive chunk: ', error);
		// abandoned happens when extension is no longer waiting for the cline instance to finish aborting (error is thrown here when any function in the for loop throws due to this.abort)
		if (!this.abandoned) {
			this.abortTask(); // if the stream failed, there's various states the task could be in (i.e. could have streamed some tools the user may have executed), so we just resort to replicating a cancel task
			await this.abortStream(
				'streaming_failed',
				assistantMessage,
				apiReq,
				lastApiReqIndex,
				error.message ?? JSON.stringify(serializeError(error), null, 2),
			);
			const history = await this.providerRef.deref()?.getTaskWithId(this.taskId);
			if (history) {
				await this.providerRef.deref()?.initClineWithHistoryItem(history.historyItem);
				// await this.providerRef.deref()?.postStateToWebview()
			}
		}
	}

	private async resetStream() {
		// reset streaming state
		this.blockProcessHandler.reset();
		this.streamChatManager.resetStream();

		this.userMessageContent = [];
		this.isThisStreamEnd = false;
		this.didRejectTool = false;
		this.didGetNewMessage = false;

		await this.diffViewProvider.reset();
	}

	async handleChunk(
		chunk: ApiStreamChunk,
		state: ProcessingState,
	): Promise<ProcessingState> {
		const newState = this.streamChatManager.handleChunk(chunk, state);
		switch (chunk.type) {
			case 'reasoning':
				const reasoningMessage = newState.reasoningMessage;
				await this.say('reasoning', reasoningMessage, undefined, true);
				break;
			case 'text':
				const assistantMessage = newState.assistantMessage;
				// parse raw assistant message into content blocks
				this.blockProcessHandler.setAssistantMessageBlocks(assistantMessage);
				if (this.blockProcessHandler.hasNewBlock()) { // has new block
					this.isThisStreamEnd = false; // new content we need to present, reset to false in case previous content set this to true
				}
				// present content to user and apply tool
				const replacing = !this.blockProcessHandler.hasNewBlock();
				this.handleAssistantMessage(replacing);
		}
		return newState;
	}

	async handleStreamingMessage(previousApiReqIndex: number, lastApiReqIndex: number) {
		let streamState: ProcessingState = {
			reasoningMessage: '',
			assistantMessage: '',
			apiReq: this.initializeApiReq(lastApiReqIndex)
		};

		await this.resetStream();

		try {
			const stream = await this.attemptApiRequest(previousApiReqIndex);

			for await (const chunk of stream) {
				streamState = await this.handleChunk(chunk, streamState);

				// 处理终止条件
				if (this.abort) {
					console.log('aborting stream...');
					if (!this.abandoned) {
						// only need to gracefully abort if this instance isn't abandoned (sometimes openrouter stream hangs, in which case this would affect future instances of cline)
						await this.abortStream('user_cancelled', streamState.assistantMessage, streamState.apiReq, lastApiReqIndex);
					}
					break;
				}

				if (this.didRejectTool) {
					streamState.assistantMessage += '\n\n[Response interrupted by user feedback]';
					break;
				}
			}
		} catch (error) {
			await this.handleStreamError(error, streamState.assistantMessage, streamState.apiReq, lastApiReqIndex);
		}

		await this.finalizeProcessing(streamState, lastApiReqIndex);
		return this.handleAssistantMessageComplete(streamState.assistantMessage);
	}

	private initializeApiReq(index: number): ClineApiReqInfo {
		const apiReq = JSON.parse(this.clineMessages[index].text || '{}');
		return {
			...apiReq,
			tokensIn: 0,
			tokensOut: 0,
			cacheWrites: 0,
			cacheReads: 0
		};
	}

	private async finalizeProcessing(state: ProcessingState, index: number) {
		this.streamChatManager.endStream();

		if (this.blockProcessHandler.hasPartialBlock()) {
			await this.handleAssistantMessage();
		}

		this.updateApiReq(state.apiReq, index);
		await this.saveClineMessages();
		await this.providerRef.deref()?.postStateToWebview();
	}

	async recursivelyMakeClineRequests(
		userContent: UserContent,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

		await this.handleMistakeLimit(userContent);

		// get previous api req's index to check token usage and determine if we need to truncate conversation history
		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === 'api_req_started');

		// getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
		// for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
		await this.say(
			'api_req_started',
			JSON.stringify({
				request:
					userContent.map((block) => formatContentBlockToMarkdown(block)).join('\n\n') + '\n\nLoading...',
			}),
		);

		const lastApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === 'api_req_started');

		await this.prepareUserContent(userContent, lastApiReqIndex);

		try {
			return this.handleStreamingMessage(previousApiReqIndex, lastApiReqIndex);
		} catch (error) {
			console.error('Error in recursivelyMakeClineRequests:', error);
			// this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonClicked, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
			return true; // needs to be true so parent loop knows to end task
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
						text.includes('<task>') || text.includes('<feedback>');

					if (block.type === 'text') {
						if (shouldProcessMentions(block.text)) {
							return {
								...block,
								text: await parseMentions(block.text, cwd, this.urlContentFetcher),
							};
						}
						return block;
					} else if (block.type === 'tool_result') {
						if (typeof block.content === 'string') {
							if (shouldProcessMentions(block.content)) {
								return {
									...block,
									content: await parseMentions(block.content, cwd, this.urlContentFetcher),
								};
							}
							return block;
						} else if (Array.isArray(block.content)) {
							const parsedContent = await Promise.all(
								block.content.map(async (contentBlock) => {
									if (contentBlock.type === 'text' && shouldProcessMentions(contentBlock.text)) {
										return {
											...contentBlock,
											text: await parseMentions(contentBlock.text, cwd, this.urlContentFetcher),
										};
									}
									return contentBlock;
								}),
							);
							return {
								...block,
								content: parsedContent,
							};
						}
						return block;
					}
					return block;
				}),
			),
		]);
	}

}

