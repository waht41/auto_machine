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
import {
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineMessage,
	ClineSay,
	ExtensionMessage,
} from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { parseMentions } from './mentions';
import { ToolUse } from './assistant-message';
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
import logger from '@/utils/logger';
import yaml from 'js-yaml';

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

	private providerRef: WeakRef<ClineProvider>;
	private abort: boolean = false;
	didFinishAborting = false;
	abandoned = false;
	private diffViewProvider: DiffViewProvider;
	private postMessageToWebview: (message: ExtensionMessage) => Promise<void>;

	// streaming
	private blockProcessHandler = new BlockProcessHandler();
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
	private isCurrentStreamEnd = false;
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
		this.streamChatManager = new StreamChatManager(this.taskId, this.api, this.taskDir, this.postTaskHistory.bind(this));
		registerInternalImplementation(this.executor);
		for (const middleware of middleWares) {
			this.executor.use(middleware);
		}


		// Initialize diffStrategy based on current state
		this.updateDiffStrategy(experimentalDiffStrategy);
	}

	async init() {
		await this.updateDiffStrategy();
		await this.streamChatManager.init();
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

	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		await this.streamChatManager.addToApiConversationHistory(message);
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		await this.streamChatManager.overwriteApiConversationHistory(newHistory);
	}

	public get clineMessages(): ClineMessage[] {
		return this.streamChatManager.clineMessages;
	}

	private async addToClineMessages(message: ClineMessage) {
		await this.streamChatManager.addToClineMessages(message);
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		await this.streamChatManager.overwriteClineMessages(newMessages);
	}

	private async saveClineMessages() {
		await this.streamChatManager.saveClineMessages();
	}

	private async postTaskHistory() {
		const historyItem = this.streamChatManager.generateHistoryItem();
		if (!historyItem) {
			return;
		}
		await this.providerRef.deref()?.updateTaskHistory(historyItem);
	}

	// Communicate with webview

	async askP({
		askType,
		text,
		partial,
		messageId = this.streamChatManager.getNewMessageId(),
	}: {
		askType: ClineAsk,
		text?: string,
		partial?: boolean,
		messageId?: number,
		noReturn?: boolean
	}) {
		return await this.askx({
			type: 'ask',
			ts: Date.now(),
			ask: askType,
			text,
			partial,
			messageId
		});
	}

	async askx(message: ClineMessage) {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

		const lastMessage = this.streamChatManager.getLastClineMessage();
		const isUpdatingPartial = !!lastMessage && lastMessage.messageId === message.messageId;

		const handleCompletion = async () => {
			if (isUpdatingPartial) {
				await this.finalizePartialMessage(message, lastMessage);
			} else {
				await this.addNewCompleteMessage(message);
			}
		};

		switch (message.partial) {
			case true:
				throw new Error(`ask should not be partial, isUpdatingPartial: ${isUpdatingPartial}`);
			case false:
				await handleCompletion();
				break;
			default:
				await this.addNewCompleteMessage(message);
		}

		this.asking = true;
	}

	private async finalizePartialMessage(message: ClineMessage, lastMessage: ClineMessage) {
		// 保留原始时间戳防止渲染闪烁
		await this.streamChatManager.setLastMessage({...message, ts: lastMessage.ts});
		await this.postMessageToWebview({
			type: 'partialMessage',
			partialMessage: lastMessage
		});
	}

	private async addNewCompleteMessage(message: ClineMessage) {
		const askTs = Date.now();
		await this.addToClineMessages({...message, ts: askTs});
		await this.updateWebviewState();
	}

	private async updateWebviewState() {
		await this.providerRef.deref()?.postStateToWebview();
	}

	public getNewMessageId() {
		return this.streamChatManager.getNewMessageId();
	}

	public getMessageId() {
		return this.streamChatManager.getMessageId();
	}

	async sayP({
		sayType,
		text,
		images,
		partial,
		messageId = this.streamChatManager.getNewMessageId(),
	}: {
		sayType: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		messageId?: number
	}) {
		const message: ClineMessage = {
			ts: Date.now(),
			type: 'say',
			say: sayType,
			text,
			images,
			partial,
			messageId
		};
		return await this.sayx(message);
	}

	async sayx(message: ClineMessage): Promise<undefined> {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}
		const lastMessage = this.streamChatManager.getLastClineMessage();
		const isUpdatingPreviousPartial =
			!!lastMessage && lastMessage.messageId === message.messageId;

		const handlePartialUpdate = async () => {
			if (isUpdatingPreviousPartial) {
				await this.streamChatManager.setLastMessage({...message, ts: lastMessage.ts});
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage});
			} else {
				await addMessage();
			}
		};

		const handleCompletion = async () => {
			if (isUpdatingPreviousPartial) {
				await this.streamChatManager.setLastMessage({...message, ts: lastMessage.ts});
				await this.postMessageToWebview({type: 'partialMessage', partialMessage: lastMessage}); // more performant than an entire postStateToWebview
			} else {
				await addMessage();
			}
		};

		const addMessage = async () => {
			// this is a new non-partial message, so add it like normal
			const sayTs = Date.now();
			await this.addToClineMessages({...message, ts: sayTs});
			await this.providerRef.deref()?.postStateToWebview();
		};

		switch (message.partial) {
			case true:
				await handlePartialUpdate();
				break;
			case false:
				await handleCompletion();
				break;
			default:
				await addMessage();
		}
	}

	// Task lifecycle

	private async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (for API) and clineMessages (for webview) need to be in sync
		// if the extension process were killed, then on restart the clineMessages might not be empty, so we need to set it to [] when we create a new Cline client (otherwise webview would show stale messages from previous session)
		await this.streamChatManager.clearHistory();
		await this.providerRef.deref()?.postStateToWebview();

		await this.sayP({sayType: 'task', text: task, images});

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
		await this.sayP({sayType: 'user_feedback', text, images, partial: true});
		const userContent: UserContent = toUserContent(text, images);
		this.initiateTaskLoop(userContent);
	}

	async receiveAnswer({uuid, result, images}: { uuid: string; result: string | object; images?: string[] }) {
		if (!uuid) {
			throw new Error('No uuid provided for answer');
		}
		const answer = typeof result === 'string' ? result : yaml.dump(result);
		await this.streamChatManager.resumeHistory();
		await this.updateAskMessageByUuid(uuid, answer);
		this.initiateTaskLoop(toUserContent(answer, images));
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
		await this.saveClineMessages();
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
		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(userContent);

			//  The way this agentic loop works is that cline will be given a task that he then calls tools to complete. unless there's an attempt_completion call, we keep responding back to him with his tool's responses until he either attempt_completion or does not use anymore tools. If he does not use anymore tools, we ask him to consider if he's completed the task and then call attempt_completion, otherwise proceed with completing the task.
			// There is a MAX_REQUESTS_PER_TASK limit to prevent infinite requests, but Cline is prompted to finish the task as efficiently as he can.

			//const totalCost = this.calculateApiCost(totalInputTokens, totalOutputTokens)
			if (didEndLoop) {
				break;
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

	async handleAssistantMessage(replacing = false, messageId?: number) {
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
				this.isCurrentStreamEnd = true;
			}
			this.blockProcessHandler.unlockPresentAssistantMessage();
			return;
		}

		// need to create copy bc while stream is updating the array, it could be updating the reference block properties too
		const block = this.blockProcessHandler.getCurrentBlock();
		switch (block.type) {
			case 'text': {
				const content = block.content;
				await this.sayP({
					sayType: 'text',
					text: content,
					partial: block.partial,
					messageId: messageId
				});
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
					logger.debug('push Tool result:', content);
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
					logger.debug('push Tool text string:', textStrings.join('\n'));
					this.sayP({
						sayType: 'text',
						text: textStrings.join('\n'),
						partial: block.partial,
						messageId
					});
					// once a tool result has been collected, ignore all other tool uses since we should only ever present one tool result per message
					this.didGetNewMessage = true;
				};

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`;
					await this.sayP({sayType: 'error', text: errorString});
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
					const res = await this.applyToolUse(block, this.getInternalContext(replacing));
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
			this.isCurrentStreamEnd = true; // will allow pwaitfor to continue
		}

		const shouldContinue = this.blockProcessHandler.shouldContinueProcessing(isThisBlockFinished);
		if (shouldContinue) {
			const continueReplacing = !isThisBlockFinished;
			const nextMessageId = continueReplacing ? this.getMessageId() : this.streamChatManager.getNewMessageId();
			this.handleAssistantMessage(continueReplacing, nextMessageId);
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
		if (this.abort) {
			return true;
		}
		let didEndLoop = false;
		if (assistantMessage.length > 0) {
			await this.addToApiConversationHistory({
				role: 'assistant',
				content: [{type: 'text', text: assistantMessage}],
			});

			// if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
			// const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
			if (!this.didGetNewMessage) {
				await this.askP({
					askType: 'followup',
					text: this.streamChatManager.endHint,
					partial: false,
					noReturn: true,
				});
				return true;
			} else if (this.asking) {
				this.asking = false;
				return true; // 不管asking，直接返回
			} else {
				didEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent);
			}
		} else {
			// if there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
			await this.sayP({
				sayType: 'error',
				text: 'Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model\'s output.'
			});
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
			this.isCurrentStreamEnd = true;
			this.blockProcessHandler.markPartialBlockAsComplete();
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
		this.isCurrentStreamEnd = false;
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
				await this.sayP({
					sayType: 'reasoning',
					text: reasoningMessage,
					partial: true,
					messageId: this.streamChatManager.getMessageId()
				});
				break;  //todo waht 大概有不少bug
			case 'text':
				const assistantMessage = newState.assistantMessage;
				// parse raw assistant message into content blocks
				this.blockProcessHandler.setAssistantMessageBlocks(assistantMessage);
				if (this.blockProcessHandler.hasNewBlock()) {
					this.isCurrentStreamEnd = false; // new content we need to present, reset to false in case previous content set this to true
					this.streamChatManager.getNewMessageId();
				}
				// present content to user and apply tool
				const replacing = !this.blockProcessHandler.hasNewBlock();
				this.handleAssistantMessage(replacing, this.streamChatManager.getMessageId());
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
			this.blockProcessHandler.markPartialBlockAsComplete();
			await this.handleAssistantMessage(true, this.streamChatManager.getMessageId());
		}
		await pWaitFor(() => this.isCurrentStreamEnd); // wait for the last block to be presented

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

		// get previous api req's index to check token usage and determine if we need to truncate conversation history
		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === 'api_req_started');

		// getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
		// for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
		await this.sayP({
			sayType: 'api_req_started',
			text: JSON.stringify({
				request: userContent.map((block) => formatContentBlockToMarkdown(block)).join('\n\n') + '\n\nLoading...',
			}),
		});

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

