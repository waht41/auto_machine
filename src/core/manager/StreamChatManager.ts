import { ApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { IApiConversationHistory } from '@core/manager/type';
import fs from 'fs/promises';
import { Anthropic } from '@anthropic-ai/sdk';
import path from 'path';
import { GlobalFileNames } from '@core/webview/ClineProvider';
import { fileExistsAtPath } from '@/utils/fs';
import { AssistantMessageContent } from '@core/assistant-message';
import { ProcessingState } from '@core/handlers/type';
import { calculateApiCost } from '@/utils/cost';
import { ClineMessage } from '@/shared/ExtensionMessage';


export class StreamChatManager{
	apiConversationHistory: IApiConversationHistory = [];
	didCompleteReadingStream = false;

	clineMessages: ClineMessage[] = [];
	readonly endHint = 'roo stop the conversion, should resume?';

	constructor(private api: ApiHandler, private taskDir: string) {
	}

	public resetStream(){
		this.didCompleteReadingStream = false;

	}

	private async getTaskDirectory(): Promise<string> {
		await fs.mkdir(this.taskDir, {recursive: true});
		return this.taskDir;
	}

	async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.apiConversationHistory);
		const fileExists = await fileExistsAtPath(filePath);
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, 'utf8'));
		}
		return [];
	}

	async addToApiConversationHistory(message: Anthropic.MessageParam) {
		const messageWithTs = {...message, ts: Date.now()};
		this.apiConversationHistory.push(messageWithTs);
		await this.saveApiConversationHistory();
	}

	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.apiConversationHistory);
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory));
		} catch (error) {
			// in the off chance this fails, we don't want to stop the task
			console.error('Failed to save API conversation history:', error);
		}
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory;
		await this.saveApiConversationHistory();
	}

	async *attemptApiRequest(): ApiStream {
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
			throw new Error('API request failed');
		}

		yield* iterator;
	}

	private convertToConversation(){
		return this.apiConversationHistory.map(({ role, content }) => {
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
			return { role, content };
		});
	}

	public getApiConversationHistory(){
		return this.apiConversationHistory;
	}

	public endStream(){
		this.didCompleteReadingStream = true;
	}

	public isStreamComplete(){
		return this.didCompleteReadingStream;
	}

	public handleChunk(chunk: ApiStreamChunk,state: ProcessingState,) {
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
	
	public async getSavedClineMessages(): Promise<ClineMessage[]> {
		const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.uiMessages);
		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, 'utf8'));
		}
		return [];
	}

	public async saveClineMessages() {
		const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.uiMessages);
		await fs.writeFile(filePath, JSON.stringify(this.clineMessages));
	}

	private async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message);
		await this.saveClineMessages();
	}

	public async resumeHistory(){
		[this.clineMessages, this.apiConversationHistory] = await Promise.all([
			this.getSavedClineMessages(),
			this.getSavedApiConversationHistory()
		]);
		this.removeEndHintMessages();
	}

	private removeEndHintMessages() {
		this.clineMessages = this.clineMessages.filter(message =>
			!(message.type === 'ask' && message.text === this.endHint)
		);
	}
}
