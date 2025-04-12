import { ApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { Anthropic } from '@anthropic-ai/sdk';
import { ProcessingState } from '@core/handlers/type';
import { calculateApiCost } from '@/utils/cost';
import { ClineApiReqInfo, ClineMessage } from '@/shared/ExtensionMessage';
import { getApiMetrics } from '@/shared/getApiMetrics';
import { findLastIndex } from '@/shared/array';
import { HistoryItem } from '@/shared/HistoryItem';
import { UIMessageService } from '@core/services/UIMessageService';
import { ApiConversationHistoryService } from '@core/services/ApiConversationHistoryService';
import { PlanService } from '@core/services/planService';
import { DIContainer } from '@core/services/di';
import { PostService } from '@core/services/postService';
import logger from '@/utils/logger';


export class StreamChatManager {
	didCompleteReadingStream = false;


	private uiMessageService!: UIMessageService;
	private apiHistoryService!: ApiConversationHistoryService;
	private planService!: PlanService;
	private postService!: PostService;


	constructor(private di: DIContainer,private api: ApiHandler, private taskId: string) {}

	async init() {
		this.planService = await this.di.getByType(PlanService);
		this.uiMessageService = await this.di.getByType(UIMessageService);
		this.apiHistoryService = await this.di.getByType(ApiConversationHistoryService);
		this.postService = await this.di.getByType(PostService);
	}

	public get metaRegex() {
		return this.apiHistoryService.metaRegex;
	}

	public get endHint() {
		return this.uiMessageService.endHint;
	}

	public get clineMessages() {
		return this.uiMessageService.clineMessages;
	}

	public set clineMessages(clineMessages: ClineMessage[]) {
		this.uiMessageService.clineMessages = clineMessages;
	}

	public get apiConversationHistory() {
		return this.apiHistoryService.apiConversationHistory;
	}

	public resetStream() {
		this.didCompleteReadingStream = false;
	}

	public async clearHistory() {
		await this.apiHistoryService.cleanHistory();
		await this.uiMessageService.cleanHistory();
	}

	async addToApiConversationHistory(message: Anthropic.MessageParam) {
		await this.apiHistoryService.addToApiConversationHistory(message);
	}

	public getHistoryContentWithId(historyId: number): Anthropic.MessageParam | null {
		return this.apiHistoryService.getHistoryContentWithId(historyId);
	}

	public getHistoryTextWithId(historyId: number): string | null {
		return this.apiHistoryService.getHistoryTextWithId(historyId);
	}

	async halfApiConversationHistory() {
		await this.apiHistoryService.halfConversation();
	}

	public generateHistoryItem(): HistoryItem | null {
		if (!this.clineMessages.length) {
			return null;
		}
		const apiMetrics = getApiMetrics(this.clineMessages.slice(1));
		const taskMessage = this.clineMessages[0]; // first message is always the task say
		const lastRelevantMessage =
			this.clineMessages[
				findLastIndex(
					this.clineMessages,
					(m) => !(m.ask === 'resume_task' || m.ask === 'resume_completed_task'),
				)
			];
		return {
			id: this.taskId,
			ts: lastRelevantMessage.ts,
			task: taskMessage.text ?? '',
			tokensIn: apiMetrics.totalTokensIn,
			tokensOut: apiMetrics.totalTokensOut,
			cacheWrites: apiMetrics.totalCacheWrites,
			cacheReads: apiMetrics.totalCacheReads,
			totalCost: apiMetrics.totalCost,
		};
	}

	async checkMessage() {
		// If the previous API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === 'api_req_started');
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
					await this.halfApiConversationHistory();
				}
			}
		}
	}

	async* attemptApiRequest(): ApiStream {
		await this.checkMessage();
		const parentId = this.uiMessageService.getState('parentId');
		const defaultTriggers : string[] = [];
		if (parentId){
			defaultTriggers.push('parallel');

		}
		const systemPrompt = await SYSTEM_PROMPT({defaultTriggers});
		if (parentId){
			logger.debug('parentId', parentId, this.taskId, systemPrompt);
		}
		// Clean conversation history by:
		// 1. Converting to Anthropic.MessageParam by spreading only the API-required properties
		// 2. Converting image blocks to text descriptions if model doesn't support images
		const cleanConversationHistory = this.convertToConversation();
		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory);
		const iterator = stream[Symbol.asyncIterator]();
		try {
			const firstChunk = await iterator.next();
			yield firstChunk.value;
		} catch (error) {
			console.error(error);
			throw new Error('API request failed: ' + JSON.stringify(error));
		}

		yield* iterator;
	}

	private convertToConversation() {
		return this.apiConversationHistory.map(({role, content}) => {
			// Handle array content (could contain image blocks)
			if (Array.isArray(content)) {
				if (!this.api.getModel().info.supportsImages) {
					// Convert image blocks to text descriptions
					content = content.map((block) => {
						if (block.type === 'image') {
							// Convert image blocks to text descriptions
							// Note: We can't access the actual image content/url due to API limitations,
							// but we can indicate that an image was present in the conversation
							return {
								type: 'text',
								text: '[Referenced image in conversation]',
							};
						}
						return block;
					});
				}
			}
			return {role, content};
		});
	}

	public endStream() {
		this.didCompleteReadingStream = true;

	}

	public isStreamComplete() {
		return this.didCompleteReadingStream;
	}

	public handleChunk(chunk: ApiStreamChunk, state: ProcessingState,) {
		switch (chunk.type) {
			case 'reasoning':
				const reasoningMessage = state.reasoningMessage + chunk.text;
				return {...state, reasoningMessage};

			case 'usage':
				const apiReq = {
					...state.apiReq,
					tokensIn: chunk.inputTokens,
					tokensOut: chunk.outputTokens,
					cacheWrites: chunk.cacheWriteTokens ?? 0,
					cacheReads: chunk.cacheReadTokens ?? 0,
					cost: chunk.totalCost
				};
				apiReq.cost = apiReq.cost ??
					calculateApiCost(this.api.getModel().info, apiReq.tokensIn, apiReq.tokensOut, apiReq.cacheWrites, apiReq.cacheReads);
				return {
					...state,
					apiReq
				};

			case 'text':
				const assistantMessage = state.assistantMessage + chunk.text;
				return {...state, assistantMessage: assistantMessage};

			default:
				return state;
		}
	}


	public async saveClineMessages() {
		await this.uiMessageService.saveClineMessages();
	}

	async addToClineMessages(message: ClineMessage) {
		await this.uiMessageService.addToClineMessages(message);
	}

	public async resumeHistory() {
		await this.apiHistoryService.loadHistory();
		await this.uiMessageService.loadHistory();
		const planSnapshot = this.uiMessageService.getState('plan');
		if (planSnapshot){
			this.planService.setPlan(planSnapshot.steps, planSnapshot.currentStep);
		}
		this.removeEndHintMessages();
	}

	private removeEndHintMessages() {
		this.clineMessages = this.clineMessages.filter(message =>
			!(message.type === 'ask' && message.text === this.endHint)
		);
	}

	public getNewMessageId() {
		return this.uiMessageService.getNewMessageId();
	}

	public getMessageId() {
		return this.uiMessageService.getMessageId();
	}

	public getLastClineMessage() {
		return this.uiMessageService.getLastClineMessage();
	}

	public getTask(){
		return this.uiMessageService.task;
	}

	public async setLastMessage(message: ClineMessage) {
		await this.uiMessageService.setLastMessage(message);
	}

	public async updateApiRequest(apiReq: ClineApiReqInfo){
		const lastApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === 'api_req_started');
		this.clineMessages[lastApiReqIndex].text = JSON.stringify(apiReq);
		await this.uiMessageService.updateApiRequest(apiReq);
	}

	public async chat(message: ClineMessage) {
		const lastMessage = this.getLastClineMessage();
		const isUpdatingPreviousPartial =
			!!lastMessage && lastMessage.messageId === message.messageId;

		const handleCompletion = async () => {
			if (isUpdatingPreviousPartial) {
				await this.finalizePartialMessage(message,lastMessage);
			} else {
				await this.addNewCompleteMessage(message,getTs());
			}
		};

		const getTs = ()=> {
			if (isUpdatingPreviousPartial) {
				return lastMessage?.ts ?? message.ts;
			}
			return Date.now();
		};

		await handleCompletion();
	}

	private async finalizePartialMessage(message: ClineMessage, lastMessage: ClineMessage) {
		// 保留原始时间戳防止渲染闪烁
		await this.setLastMessage({...message, ts: lastMessage.ts});
		await this.postService.postClineMessage({
			type: 'partialMessage',
			partialMessage: lastMessage,
			id: this.taskId
		});
	}

	private async addNewCompleteMessage(message: ClineMessage, ts?: number) {
		const askTs = ts ?? Date.now();
		await this.addToClineMessages({...message, ts: askTs});
		await this.postClineMessage();
	}

	async postClineMessage() {
		await this.postService.postClineMessage({
			type: 'clineMessage',
			id: this.taskId,
			clineMessage: this.clineMessages
		});
	}

	public async updateAskMessageByUuid(uuid: string, result: string): Promise<boolean> {
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
}
