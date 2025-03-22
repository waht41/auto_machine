import { ClineMessage } from '@/shared/ExtensionMessage';
import path from 'path';
import { GlobalFileNames } from '@core/webview/const';
import { fileExistsAtPath } from '@/utils/fs';
import fs from 'fs/promises';
import logger from '@/utils/logger';
import { DeepReadonly } from '@/utils/type';
import { IUIMessage } from '@core/services/type';

export class UIMessageService {
	readonly endHint = 'roo stop the conversion, should resume?';
	clineMessages: ClineMessage[] = [];
	private messageId = 0;
	constructor(private taskDirectory: string, private onSaveClineMessages: () => Promise<void>) {
	}
	public async getSavedClineMessages(): Promise<ClineMessage[]> {
		const uiMessage = await this.getSavedUIMessage();
		return uiMessage.clineMessages;
	}

	public async loadHistory(){
		this.clineMessages = await this.getSavedClineMessages();
		this.messageId = this.clineMessages.reduce((maxId, { messageId }) =>
			messageId != null ? Math.max(maxId, messageId) : maxId, this.messageId);
	}

	public async cleanHistory() {
		this.clineMessages = [];
		await this.saveClineMessages();
	}

	private async getSavedUIMessage(): Promise<IUIMessage>{
		const filePath = path.join(this.taskDirectory, GlobalFileNames.uiMessages);
		if (await fileExistsAtPath(filePath)) {
			try {
				return JSON.parse(await fs.readFile(filePath, 'utf8'));
			}catch (e){
				logger.error('getSavedUIMessage parse error', e);
				console.error(e);
			}
		}
		return {clineMessages: []};
	}

	private async saveUIMessage(uiMessage: IUIMessage){
		try {
			const filePath = path.join(this.taskDirectory, GlobalFileNames.uiMessages);
			await fs.writeFile(filePath, JSON.stringify(uiMessage));
			await this.onSaveClineMessages();
		} catch (error) {
			console.error('Failed to ui messages:', error);
		}
	}

	public async saveClineMessages() {
		try {
			await this.saveUIMessage({clineMessages: this.clineMessages});
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