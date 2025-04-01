import { ApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import fs from 'fs/promises';
import { Anthropic } from '@anthropic-ai/sdk';
import path from 'path';
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


export class StreamChatManager {
	didCompleteReadingStream = false;


	private uiMessageService: UIMessageService;
	private apiHistoryService: ApiConversationHistoryService;
	private planService!: PlanService;


	constructor(private di: DIContainer,private api: ApiHandler, private taskDir: string, private onSaveUIMessages: () => Promise<void>) {
		this.uiMessageService = new UIMessageService(this.taskDir, this.onSaveUIMessages);
		this.apiHistoryService = new ApiConversationHistoryService(this.taskDir, this.getExtraMeta.bind(this));
	}

	async init() {
		this.planService = await this.di.getByType(PlanService);
		await fs.mkdir(this.taskDir, {recursive: true});
		await this.resumeHistory();
	}

	async setPlan(steps: string[], currentStep: number) {
		this.planService.setPlan(steps, currentStep);
		await this.uiMessageService.setState('plan',this.planService.getPlanSnapshot());
	}

	async nextStep(stepNumber?: number) {
		const currentStepContent =  this.planService.nextStep(stepNumber);
		if (currentStepContent){
			await this.uiMessageService.setState('plan',this.planService.getPlanSnapshot());
		}
		return currentStepContent;
	}

	getStep(index: number) {
		return this.planService.getStep(index);
	}

	private getExtraMeta() {
		return '';
		// const currentStep = this.planService.getCurrentStep();
		// return currentStep ? `currentStep: ${currentStep}` : '';
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
			id: path.basename(this.taskDir),
			ts: lastRelevantMessage.ts,
			task: taskMessage.text ?? '',
			tokensIn: apiMetrics.totalTokensIn,
			tokensOut: apiMetrics.totalTokensOut,
			cacheWrites: apiMetrics.totalCacheWrites,
			cacheReads: apiMetrics.totalCacheReads,
			totalCost: apiMetrics.totalCost,
		};
	}

	async* attemptApiRequest(): ApiStream {
		const systemPrompt = await SYSTEM_PROMPT();
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
			throw new Error('API request failed');
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

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		await this.uiMessageService.overwriteClineMessages(newMessages);
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

	public async setLastMessage(message: ClineMessage) {
		await this.uiMessageService.setLastMessage(message);
	}

	public async updateApiRequest(apiReq: ClineApiReqInfo){
		await this.uiMessageService.updateApiRequest(apiReq);
	}
}
