import { Anthropic } from '@anthropic-ai/sdk';
import path from 'path';
import { GlobalFileNames } from '@core/webview/const';
import { fileExistsAtPath } from '@/utils/fs';
import fs from 'fs/promises';
import cloneDeep from 'clone-deep';
import { isArray } from 'lodash';
import { IApiConversationHistory, IApiConversationItem } from '@core/services/type';

type TextBlockParam = Anthropic.TextBlockParam

export class ApiConversationHistoryService{
	apiConversationHistory: IApiConversationHistory = [];
	readonly metaRegex = /<meta[\s\S]*?<\/meta>/gi;
	private apiHistoryId = 0;
	constructor(private taskDir: string) {
	}

	async loadHistory(){
		this.apiConversationHistory = await this.getSavedApiConversationHistory();
	}

	async cleanHistory(){
		this.apiConversationHistory = [];
		await this.saveApiConversationHistory();
	}

	async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(this.taskDir, GlobalFileNames.apiConversationHistory);
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
			const filePath = path.join(this.taskDir, GlobalFileNames.apiConversationHistory);
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
}