import { ApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { IApiConversationHistory, IApiConversationItem } from '@core/manager/type';
import fs from 'fs/promises';
import { Anthropic } from '@anthropic-ai/sdk';
import path from 'path';
import { fileExistsAtPath } from '@/utils/fs';
import { ProcessingState } from '@core/handlers/type';
import { calculateApiCost } from '@/utils/cost';
import { ClineMessage } from '@/shared/ExtensionMessage';
import { getApiMetrics } from '@/shared/getApiMetrics';
import { combineApiRequests } from '@/shared/combineApiRequests';
import { combineCommandSequences } from '@/shared/combineCommandSequences';
import { findLastIndex } from '@/shared/array';
import { HistoryItem } from '@/shared/HistoryItem';
import { DeepReadonly } from '@/utils/type';
import { GlobalFileNames } from '@core/webview/const';
import cloneDeep from 'clone-deep';
import TextBlockParam = Anthropic.TextBlockParam;
import { isArray } from 'lodash';


export class StreamChatManager {
	apiConversationHistory: IApiConversationHistory = [];
	didCompleteReadingStream = false;

	clineMessages: ClineMessage[] = [];
	readonly endHint = 'roo stop the conversion, should resume?';
	readonly metaRegex = /<meta[\s\S]*?<\/meta>/gi;
	private messageId = 0;
	private apiHistoryId = 0;

	constructor(private taskId: string, private api: ApiHandler, private taskDir: string, private onSaveClineMessages: () => Promise<void>) {
	}

	async init() {
		await this.resumeHistory();
	}

	public resetStream() {
		this.didCompleteReadingStream = false;
	}

	public async clearHistory() {
		this.apiConversationHistory = [];
		this.clineMessages = [];
		await this.saveClineMessages();
		await this.saveApiConversationHistory();
	}

	private async getTaskDirectory(): Promise<string> {
		await fs.mkdir(this.taskDir, { recursive: true });
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
		const messageWithMeta = this.addConversationMetadata(message);
		this.apiConversationHistory.push(messageWithMeta);
		await this.saveApiConversationHistory();
	}

	private isTextBlock(content: unknown): content is TextBlockParam {
		const candidate = content as TextBlockParam;
		return candidate?.type === 'text';
	}

	private addConversationMetadata(message: Anthropic.MessageParam): IApiConversationItem {
		let content = cloneDeep(message.content);
		if (typeof content === 'string') {
			content = `${this.getMeta()}\n${content.replace(this.metaRegex, '')}`;
		}
		if (isArray(content)) {
			content = content.map(block => {
				if (this.isTextBlock(block)) {
					block.text = `${this.getMeta()}\n${block.text.replace(this.metaRegex, '')}`;
				}
				return block;
			});
		}
		return { ...message, content, ts: Date.now() };
	}

	private getMeta() {
		return `<meta>historyId:${++this.apiHistoryId}</meta>`;
	}

	private extractMeta(content: Anthropic.MessageParam['content']): Record<string, string> {
		let metaString = '';
		const metaRegex = /<meta>(.*?)<\/meta>/;

		if (typeof content === 'string') {
			const match = content.match(metaRegex);
			metaString = match?.[1] || '';
		} else if (Array.isArray(content)) {
			for (const block of content) {
				if (this.isTextBlock(block)) {
					const match = block.text.match(metaRegex);
					if (match) {
						metaString = match[1];
						break;
					}
				}
			}
		}

		return metaString.split(',')
			.reduce((acc: Record<string, string>, pair) => {
				const [key, value] = pair.split(':').map(s => s.trim());
				if (key && value) acc[key] = value;
				return acc;
			}, {});
	}

	public getHistoryContentWithId(historyId: number): Anthropic.MessageParam | null {
		for (const item of this.apiConversationHistory) {
			const meta = this.extractMeta(item.content);
			const itemHistoryId = parseInt(meta.historyId, 10);

			if (!isNaN(itemHistoryId) && itemHistoryId === historyId) {
				return {
					role: item.role,
					content: item.content
				};
			}
		}
		return null;
	}

	public getHistoryTextWithId(historyId: number): string | null {
		const item = this.getHistoryContentWithId(historyId);
		if (item) {
			if (typeof item.content === 'string') {
				return item.content;
			}
			if (Array.isArray(item.content)) {
				return item.content.map(block => {
					if (this.isTextBlock(block)) {
						return block.text;
					}
					return '';
				}).join('\n');
			}
		}
		return null;
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

	public generateHistoryItem(): HistoryItem | null {
		if (!this.clineMessages.length) {
			return null;
		}
		const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))));
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

	public async getSavedClineMessages(): Promise<ClineMessage[]> {
		const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.uiMessages);
		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, 'utf8'));
		}
		return [];
	}

	public async saveClineMessages() {
		try {
			const filePath = path.join(await this.getTaskDirectory(), GlobalFileNames.uiMessages);
			await fs.writeFile(filePath, JSON.stringify(this.clineMessages));
			await this.onSaveClineMessages();
		} catch (error) {
			console.error('Failed to save cline messages:', error);
		}
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages;
		await this.saveClineMessages();
	}

	async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message);
		await this.saveClineMessages();
	}

	public async resumeHistory() {
		[this.clineMessages, this.apiConversationHistory] = await Promise.all([
			this.getSavedClineMessages(),
			this.getSavedApiConversationHistory()
		]);
		this.removeEndHintMessages();
		this.messageId = this.clineMessages.reduce((maxId, { messageId }) =>
			messageId != null ? Math.max(maxId, messageId) : maxId, this.messageId);
	}

	private removeEndHintMessages() {
		this.clineMessages = this.clineMessages.filter(message =>
			!(message.type === 'ask' && message.text === this.endHint)
		);
	}

	public getNewMessageId() {
		return ++this.messageId;
	}

	public getMessageId() {
		return this.messageId;
	}

	public getLastClineMessage() {
		const lastMessage = this.clineMessages.at(-1);
		if (!lastMessage) {
			return null;
		}
		return lastMessage as DeepReadonly<ClineMessage>;
	}

	public async setLastMessage(message: ClineMessage) {
		if (this.clineMessages.length < 1) { // first message is always the task say, so we need at least 2 messages
			console.error('cline message too short', this.clineMessages);
			return;
		}
		this.clineMessages[this.clineMessages.length - 1] = message;
		await this.saveClineMessages();
	}
}
