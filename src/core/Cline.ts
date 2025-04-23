import { Anthropic } from '@anthropic-ai/sdk';
import pWaitFor from 'p-wait-for';
import * as path from 'path';
import { serializeError } from 'serialize-error';
import { ApiHandler, buildApiHandler } from '@/api';
import { ApiStreamChunk } from '@/api/transform/stream';
import { DiffViewProvider } from '@/integrations/editor/DiffViewProvider';
import { formatContentBlockToMarkdown } from '@/integrations/misc/export-markdown';
import { TerminalManager } from '@/integrations/terminal/TerminalManager';
import { UrlContentFetcher } from '@/services/browser/UrlContentFetcher';
import { ApiConfiguration } from '@/shared/api';
import { findLastIndex } from '@/shared/array';
import {
	ClineApiReqInfo,
	ClineAsk,
	ClineMessage,
	ClineSay,
	ExtensionMessage
} from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { parseMentions } from './mentions';
import { ToolUse } from './assistant-message';
import { formatResponse } from './prompts/responses';
import { McpHub } from '@operation/MCP';
import crypto from 'crypto';
import process from 'node:process';
import { convertUserContentString, toUserContent, UserContent } from '@core/prompts/utils';
import { Command, Middleware } from '@executors/types';
import { StreamChatManager } from '@core/manager/StreamChatManager';
import { IInternalContext } from '@core/internal-implementation/type';
import { ProcessingState } from '@core/handlers/type';
import { BlockProcessHandler } from '@core/handlers/BlockProcessHandler';
import logger from '@/utils/logger';
import yaml from 'js-yaml';
import { aCreateService, DIContainer } from '@core/services/di';
import { PlanService } from '@core/services/planService';
import { UIMessageService } from '@core/services/UIMessageService';
import { ApiConversationHistoryService } from '@core/services/ApiConversationHistoryService';
import { PostService } from '@core/services/postService';
import { MemoryService } from './services/memoryService';
import { ToolManager } from '@core/manager/ToolManager';
import { ICreateSubCline } from '@core/webview/type';
import { InterClineMessage } from '@core/services/type';
import { EventEmitter } from 'events';
import { AllowedToolTree } from '@core/tool-adapter/AllowedToolTree';
import { isAutoApproval as isAutoApprovalX } from '@core/internal-implementation/middleware';

const cwd = process.cwd();

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

interface IProp {
	apiConfiguration: ApiConfiguration,
	postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
	postStateToWebview: () => Promise<void>,
	updateTaskHistory: (historyItem: HistoryItem) => Promise<void>,
	postInterClineMessage: (clineMessage: InterClineMessage) => Promise<void>,
	createCline: (prop: ICreateSubCline) => Promise<string>
	customInstructions?: string,
	historyItem?: HistoryItem | undefined,
	middleWares?: Middleware[],
	mcpHub?: McpHub
	taskParentDir: string,
	memoryDir: string,
	allowedToolTree: AllowedToolTree
}

export class Cline {
	readonly taskId: string;
	api: ApiHandler;
	private terminalManager: TerminalManager;
	private urlContentFetcher: UrlContentFetcher;
	customInstructions?: string;
	diffEnabled: boolean = false;
	fuzzyMatchThreshold: number = 1.0;

	private readonly taskDir: string;

	private abort: boolean = false;
	abortComplete = false;
	private diffViewProvider: DiffViewProvider;

	// streaming
	private blockProcessHandler = new BlockProcessHandler();
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
	private isCurrentStreamEnd = false;

	private toolManager: ToolManager;
	private asking = false;
	private mcpHub?: McpHub;
	private streamChatManager: StreamChatManager;
	public di = new DIContainer();
	private postService!: PostService;
	private uiMessageService!: UIMessageService;
	private allowedToolTree: AllowedToolTree;
	clineBus = new EventEmitter();
	messageBox: string[] = [];
	remainingChildNum = 0;

	constructor(
		prop: IProp
	) {
		const {
			apiConfiguration,
			customInstructions,
			historyItem,
			middleWares = [],
			mcpHub,
			taskParentDir
		} = prop;
		this.taskId = historyItem ? historyItem.id : crypto.randomUUID();
		this.api = buildApiHandler(apiConfiguration);
		this.terminalManager = new TerminalManager();
		this.urlContentFetcher = new UrlContentFetcher('./storage'); //todo 待删
		this.customInstructions = customInstructions;
		this.diffViewProvider = new DiffViewProvider(cwd);
		this.mcpHub = mcpHub;
		this.taskDir = path.join(taskParentDir, this.taskId);
		this.streamChatManager = new StreamChatManager(this.di,this.api, this.taskId);
		this.toolManager = new ToolManager(this.di, middleWares);
		this.allowedToolTree = prop.allowedToolTree;

		this.registerServices(prop);

	}

	private registerServices(prop: IProp) {
		this.di.register(PlanService.serviceId,{
			factory: PlanService,
			dependencies:[DIContainer.service(UIMessageService)]
		});
		this.di.register(UIMessageService.serviceId,{
			factory: aCreateService(UIMessageService),
			dependencies:[this.taskDir, this.postTaskHistory.bind(this)]
		});
		this.di.register(ApiConversationHistoryService.serviceId,{
			factory: aCreateService(ApiConversationHistoryService),
			dependencies:[this.taskDir]
		});
		this.di.register(PostService.serviceId,{
			factory: PostService,
			dependencies:[prop.postMessageToWebview, prop.postStateToWebview, prop.updateTaskHistory, prop.createCline, prop.postInterClineMessage]
		});
		this.di.register(MemoryService.serviceId,{
			factory: aCreateService(MemoryService),
			dependencies:[prop.memoryDir]
		});
	}

	async init() {
		await this.streamChatManager.init();
		await this.toolManager.init();
		this.postService = await this.di.getByType(PostService);
		this.uiMessageService = await this.di.getByType(UIMessageService);
	}


	async getTask(){
		return this.streamChatManager.getTask();
	}

	async setParentId(parentId:string){
		await this.uiMessageService.setState('parentId', parentId);
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
			console.error('no new message get when resume');
		}
	}

	public get clineMessages(): ClineMessage[] {
		return this.streamChatManager.clineMessages;
	}

	private async postTaskHistory() {
		const historyItem = this.streamChatManager.generateHistoryItem();
		if (!historyItem) {
			return;
		}
		await this.postService.updateTaskHistory(historyItem);
	}

	async postClineMessage() {
		await this.streamChatManager.postClineMessage();
	}

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
	}) {
		this.asking = true;
		return await this.chat({
			type: 'ask',
			ts: Date.now(),
			ask: askType,
			text,
			partial,
			messageId
		});
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
		return await this.chat(message);
	}

	async chat(message: ClineMessage): Promise<undefined> {
		if (this.abortComplete) {
			logger.error('chat after abort complete',message);
			return;
		}
		await this.streamChatManager.chat(message);
	}

	// Task lifecycle

	private async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (for API) and clineMessages (for webview) need to be in sync
		// if the extension process were killed, then on restart the clineMessages might not be empty, so we need to set it to [] when we create a new Cline client (otherwise webview would show stale messages from previous session)
		await this.streamChatManager.clearHistory();
		await this.streamChatManager.postClineMessage();

		await this.sayP({sayType: 'task', text: task, images});
		await this.sayP({sayType: 'user_feedback', text: task, images});

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
		await this.streamChatManager.updateAskMessageByUuid(uuid, answer);
		this.initiateTaskLoop(toUserContent(answer, images));
	}

	private getInternalContext(replacing: boolean = false): IInternalContext {
		return {
			cline: this,
			mcpHub: this.mcpHub,
			di: this.di,
			replacing: replacing
		};
	}

	async receiveApproval({tool}: { tool: Command }) {
		const result = await this.toolManager.applyCommand(tool, this.getInternalContext());
		const text = result ?? '';
		await this.streamChatManager.resumeHistory();
		await this.streamChatManager.addAgentStream(text);
		const userContent: UserContent = toUserContent(text, undefined);
		this.initiateTaskLoop(userContent);
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
	}

	private isAutoApproval(command: Command): boolean {
		return isAutoApprovalX(command, this.allowedToolTree);
	}

	async handleAssistantMessage() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			if (this.abort) {
				this.streamChatManager.endStream();
				return;
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
			const currentMessageId = this.blockProcessHandler.getCurrentMessageId();
			switch (block.type) {
				case 'text': {
					const content = block.content.replace(this.streamChatManager.metaRegex, '');
					// logger.debug('handleAssistantMessage: text',currentMessageId, content);
					await this.sayP({
						sayType: 'text',
						text: content,
						partial: block.partial,
						messageId: currentMessageId
					});
					break;
				}
				case 'tool_use':
					if (block.partial) {
						break;
					}
					logger.debug('handleAssistantMessage: tool_use', block);
					if (this.isAutoApproval(this.block2Command(block))) {
						await this.sayP({ sayType: 'text', text: `apply tool \n ${yaml.dump(block.params)}`, partial: false, messageId: currentMessageId });
					}


					const handleError = async (action: string, error: Error) => {
						await this.streamChatManager.changeLastApiReqStatus('error',`Error when executing tool ${block.name}`);
						const errorString = `Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`;
						await this.sayP({ sayType: 'error', text: errorString });
						await this.pushToolResult(formatResponse.toolError(errorString));
					};

					if (block.name === 'ask') { // assign UUID to receive corresponding answers
						block.params.uuid = crypto.randomUUID();
					}

					try {
						const isReplacing = !this.blockProcessHandler.hasNewBlock();
						const res = await this.applyToolUse(block, this.getInternalContext(isReplacing));
						if (typeof res === 'string') {
							await this.streamChatManager.changeLastApiReqStatus('completed', `Tool ${block.name} executed successfully`);
							await this.pushToolResult(res);
						}
					} catch (e) {
						await handleError(`executing tool ${block.name}, `, e);
					}
					break;
			}

			const isThisBlockFinished = !block.partial;
			if (isThisBlockFinished){
				this.blockProcessHandler.toNextBlock();
				logger.debug('handleAssistantMessage toNextBlock', this.blockProcessHandler.getCurrentMessageId());
			}
			if (isThisBlockFinished && blockPositionState.last) {
				// its okay that we increment if !didCompleteReadingStream, it'll just return bc out of bounds and as streaming continues it will call presentAssitantMessage if a new block is ready. if streaming is finished then we set isThisStreamEnd to true when out of bounds. This gracefully allows the stream to continue on and all potential content blocks be presented.
				// last block is complete and it is finished executing
				this.isCurrentStreamEnd = true;
			}
			this.blockProcessHandler.unlockProcessing();

			const shouldContinue = this.blockProcessHandler.shouldContinueProcessing(isThisBlockFinished);
			if (!shouldContinue) {
				break;
			}
		}
	}

	private async pushToolResult (content: ToolResponse) {
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
		logger.debug('handleAssistantMessage pushToolResult',textStrings);
		await this.streamChatManager.addAgentStream(textStrings.join('\n'));
	}

	private block2Command(block:ToolUse): Command{
		return {...block.params, type: block.name};
	}

	async applyToolUse(block: ToolUse, context?: IInternalContext): Promise<string | unknown> {
		return await this.toolManager.applyCommand({...block.params, type: block.name}, context);
	}

	async applyCommand(command: Command, context?: IInternalContext) {
		return await this.toolManager.applyCommand(command, context);
	}

	private async abortStream({apiReq, assistantMessage}: ProcessingState) {
		if (this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges(); // closes diff view
		}

		const lastMessage = this.streamChatManager.getLastClineMessage();
		if (lastMessage && lastMessage.partial) { // if last message is a partial we need to update and save it
			// sayP will replace last message
			await this.sayP({sayType: 'text', text: lastMessage.text, partial: false, messageId: lastMessage.messageId});
			console.log('abort last message', this.streamChatManager.getLastClineMessage());
		}

		// Let assistant know their response was interrupted for when task is resumed
		await this.streamChatManager.addToApiConversationHistory({
			role: 'assistant',
			content: [
				{
					type: 'text',
					text: assistantMessage + `\n\n[${apiReq.cancelReason}]`,
				},
			],
		});

		await this.streamChatManager.updateApiRequest(apiReq);

		await this.streamChatManager.postClineMessage();

		// signals to provider that it can retrieve the saved messages from disk, as abortTask can not be awaited on in nature
		this.abortComplete = true;
	}

	private async handleStreamError(streamState: ProcessingState) {
		// abandoned happens when extension is no longer waiting for the cline instance to finish aborting (error is thrown here when any function in the for loop throws due to this.abort)
		if (this.abortComplete){
			return;
		}
		this.isCurrentStreamEnd = true;
		this.blockProcessHandler.markPartialBlockAsComplete();
		this.abortTask(); // if the stream failed, there's various states the task could be in (i.e. could have streamed some tools the user may have executed), so we just resort to replicating a cancel task
		await this.streamChatManager.changeLastApiReqStatus('error','Error when receiving message');
		await this.abortStream(streamState);
	}

	private async resetStream() {
		// reset streaming state
		this.blockProcessHandler.reset();
		this.streamChatManager.resetStream();

		this.userMessageContent = [];
		this.isCurrentStreamEnd = false;

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

					this.blockProcessHandler.addMessageId(this.streamChatManager.getNewMessageId());
				}
				// present content to user and apply tool
				this.handleAssistantMessage();
		}
		return newState;
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

	async handleStreamingMessage(lastApiReqIndex: number) {
		let streamState: ProcessingState = {
			reasoningMessage: '',
			assistantMessage: '',
			apiReq: this.initializeApiReq(lastApiReqIndex)
		};

		await this.resetStream();

		try {
			const stream = this.streamChatManager.attemptApiRequest();
			for await (const chunk of stream) {
				streamState = await this.handleChunk(chunk, streamState);
				// 处理终止条件
				if (this.abort) {
					console.log('aborting stream...');
					if (!this.abortComplete) {
						await this.streamChatManager.changeLastApiReqStatus('cancelled', 'Uer canceled message');
						// only need to gracefully abort if this instance isn't abandoned (sometimes openrouter stream hangs, in which case this would affect future instances of cline)
						streamState.apiReq.cancelReason = 'user_cancelled';
						await this.abortStream(streamState);
					}
					break;
				}
			}
		} catch (error) {
			console.error('error when receive chunk: ', error);
			streamState.apiReq.cancelReason = 'streaming_failed';
			streamState.apiReq.streamingFailedMessage = error.message ?? JSON.stringify(serializeError(error), null, 2);
			await this.handleStreamError(streamState);
		}

		return this.handleAssistantMessageComplete(streamState);
	}

	async handleAssistantMessageComplete(streamState: ProcessingState) {
		await this.finalizeProcessing(streamState);
		const assistantMessage = streamState.assistantMessage;
		await this.streamChatManager.postClineMessage();
		// now add to apiconversationhistory
		// need to save assistant responses to file before proceeding to tool use since user can exit at any moment and we wouldn't be able to save the assistant's response
		if (this.abort) {
			return true;
		}
		let didEndLoop = false;

		if (assistantMessage.length > 0) {
			await this.streamChatManager.addToApiConversationHistory({
				role: 'assistant',
				content: [{type: 'text', text: assistantMessage}],
			});

			await this.clearMessageBox();

			console.log(`[cline] user content message, task id ${this.taskId}`,this.userMessageContent);

			// if the model did not tool use, then we need to tell it to either use a tool or attempt_completion
			// const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
			if (this.userMessageContent.length === 0) {
				const status = this.streamChatManager.getLastApiReqStatus();
				if (!status) {
					await this.streamChatManager.changeLastApiReqStatus('completed', 'Message completed');
				}

				return true;
			}

			if (this.asking) {
				this.asking = false;
				return true; // 不管asking，直接返回
			}

			didEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent);
		} else {
			await this.sayP({
				sayType: 'error',
				text: 'Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model\'s output.'
			});
		}

		return didEndLoop;
	}

	private async finalizeProcessing(state: ProcessingState) {
		this.streamChatManager.endStream();
		if (this.blockProcessHandler.hasPartialBlock()) {
			this.blockProcessHandler.markPartialBlockAsComplete();
			logger.debug('finalizing processing',this.blockProcessHandler.getCurrentBlock());
			await this.handleAssistantMessage();
		}
		await pWaitFor(() => this.isCurrentStreamEnd); // wait for the last block to be presented

		await this.streamChatManager.updateApiRequest(state.apiReq);
		await this.streamChatManager.postClineMessage();
	}

	private async clearMessageBox(){
		await pWaitFor(()=> this.remainingChildNum === 0);
		if (this.messageBox.length>0){
			await this.sayP({sayType: 'text', text: this.messageBox.join('\n')});
			this.userMessageContent.push({ type: 'text', text: this.messageBox.join('\n') });
			this.messageBox.splice(0, this.messageBox.length);
		}
	}

	async recursivelyMakeClineRequests(
		userContent: UserContent,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

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
			return this.handleStreamingMessage(lastApiReqIndex);
		} catch (error) {
			console.error('Error in recursivelyMakeClineRequests:', error);
			// this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonClicked, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
			return true; // needs to be true so parent loop knows to end task
		}
	}

	private async prepareUserContent(userContent: UserContent, lastApiReqIndex: number): Promise<UserContent> {
		const parsedUserContent = await this.loadContext(userContent);
		await this.streamChatManager.addToApiConversationHistory({role: 'user', content: parsedUserContent});

		// since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
		this.clineMessages[lastApiReqIndex].text = JSON.stringify({
			request: parsedUserContent.map((block) => formatContentBlockToMarkdown(block)).join('\n\n'),
		} satisfies ClineApiReqInfo);
		await this.streamChatManager.saveClineMessages();
		await this.streamChatManager.postClineMessage();

		return parsedUserContent;
	}

	async loadContext(userContent: UserContent) {
		// We need to apply parseMentions() to:
		// 1. All TextBlockParam's text (first user message with task)
		// 2. ToolResultBlockParam's content/context text arrays if it contains "<feedback>" (see formatToolDeniedFeedback, attemptCompletion, executeCommand, and consecutiveMistakeCount >= 3) or "<answer>" (see askFollowupQuestion), we place all user generated content in these tags so they can effectively be used as markers for when we should parse mentions)
		const shouldProcessMentions = (text: string) =>
			text.includes('<task>') || text.includes('<feedback>');
		return await convertUserContentString(userContent, (text) => parseMentions(text, cwd, this.urlContentFetcher), shouldProcessMentions);
	}

	receiveInterMessage(message: InterClineMessage) {
		console.log('[waht]','receiveInterMessage',message);
		this.clineBus.emit('interMessage', message);
	}

	async postInterMessage(message: InterClineMessage) {
		await this.postService.postInterClineMessage(message);
	}
}
