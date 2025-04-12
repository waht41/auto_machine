import { ClineApiReqInfo, ClineMessage } from '@/shared/ExtensionMessage';
import path from 'path';
import { GlobalFileNames } from '@core/webview/const';
import { fileExistsAtPath } from '@/utils/fs';
import fs from 'fs/promises';
import logger from '@/utils/logger';
import { DeepReadonly } from '@/utils/type';
import { IUIMessage } from '@core/services/type';

export class UIMessageService {
	static readonly serviceId = 'UIMessageService';
	readonly endHint = 'roo stop the conversion, should resume?';
	private uiMessage: IUIMessage = {clineMessages:[], task: ''};
	private messageId = 0;
	constructor(private taskDirectory: string, private onSaveUIMessages: () => Promise<void>) {
	}

	async init() {
		await this.loadHistory();
	}

	public get clineMessages() {
		return this.uiMessage.clineMessages;
	}

	public set clineMessages(clineMessages: ClineMessage[]) {
		this.uiMessage.clineMessages = clineMessages;
	}

	public get task(){ //todo 存在bug，task可能未被写入
		return this.uiMessage.task;
	}

	public async loadHistory(){
		await fs.mkdir(this.taskDirectory, {recursive: true});
		this.uiMessage = await this.getSavedUIMessage();
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
		return {clineMessages: [], task: ''};
	}

	private async saveUIMessage(){
		try {
			const filePath = path.join(this.taskDirectory, GlobalFileNames.uiMessages);
			await fs.writeFile(filePath, JSON.stringify(this.uiMessage));
			await this.onSaveUIMessages();
		} catch (error) {
			console.error('Failed to ui messages:', error);
		}
	}

	public async saveClineMessages() {
		try {
			await this.saveUIMessage();
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

	public getState<T extends keyof IUIMessage>(key: T) : IUIMessage[T] {
		return this.uiMessage[key];
	}

	public async setState<T extends keyof IUIMessage>(key: T, value: IUIMessage[T]) {
		this.uiMessage[key] = value;
		await this.saveUIMessage();
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

	async updateApiRequest(apiReq: ClineApiReqInfo){
		this.uiMessage.apiReqInfo = apiReq;
		await this.saveUIMessage();
	}
}