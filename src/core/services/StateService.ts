import { Config } from '@core/storage/config';
import path from 'path';
import { configPath } from '@core/storage/common';
import { SecretStorage } from '@core/storage/secret';
import { SecretKey } from '@core/webview/type';
import { ApiConfiguration } from '@/shared/api';
import { AssistantStructure, IConfig, secretKeys } from '@core/storage/type';
import { GlobalFileNames } from '@core/webview/const';
import { TaskHistoryStorage } from '@core/storage/taskHistory';
import { HistoryItem } from '@/shared/HistoryItem';
import { Assistant } from '@core/storage/assistant';

export class StateService {
	private static _instance: StateService;
	private _secrets = new SecretStorage(path.join(configPath, GlobalFileNames.secrets));
	private _config = new Config(path.join(configPath, GlobalFileNames.config));
	private _assistant = new Assistant(path.join(configPath, GlobalFileNames.assistant));
	private _taskHistory: TaskHistoryStorage = new TaskHistoryStorage(this._config.get('taskDirRoot'));

	private constructor() {
	}

	async init() {
		await this._taskHistory.init();
	}

	public static getInstance(): StateService {
		if (!StateService._instance) {
			StateService._instance = new StateService();
		}
		return StateService._instance;
	}

	public async getState() : Promise<IConfig> {
		const [globalStates, secrets,  assistants] = await Promise.all([
			this.getAllConfig(),
			this.getSecrets(),
			this.getAssistants()
		]);
		globalStates.apiConfiguration = {...globalStates.apiConfiguration, ...secrets};
		globalStates.assistants = assistants;
		return globalStates;
	}

	public async getApiConfig(): Promise<ApiConfiguration> {
		const apiConfig = this._config.get('apiConfiguration');
		const secrets = await this.getSecrets();
		return { ...apiConfig, ...secrets };
	}

	public async getAllConfig() {
		return this._config.getAll();
	}

	public async getSecrets() {
		return this._secrets.getAll();
	}

	public async updateApiConfig(apiConfiguration: ApiConfiguration): Promise<void> {
		const apiConfigWithoutSecrets :ApiConfiguration = { ...apiConfiguration };
		for (const [key, value] of Object.entries(apiConfiguration)) {
			if (secretKeys.includes(key as SecretKey)) {
				await this.storeSecret(key as SecretKey, value as string | undefined);
				if (value) {
					delete apiConfigWithoutSecrets[key as SecretKey];
				}
			}
		}
		await this._config.set('apiConfiguration', apiConfigWithoutSecrets);
	}

	public async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this._secrets.set(key, value);
		}
	}

	public async deleteSecret(key: SecretKey) {
		await this._secrets.remove(key);
	}

	public getConfig() {
		return this._config;
	}

	public getTaskHistory() {
		return this._taskHistory.getTaskHistory();
	}

	public addTaskHistory(item: HistoryItem) {
		return this._taskHistory.addTaskHistory(item);
	}

	public async deleteTaskHistory(id: string) {
		await this._taskHistory.deleteTaskHistory(id);
	}

	public async upsertAssistant(assistant: AssistantStructure) {
		await this._assistant.upsertAssistant(assistant);
	}

	public async removeAssistant(assistantName: string) {
		await this._assistant.removeAssistant(assistantName);
	}

	public async getAssistants() {
		return this._assistant.get('assistants');
	}

	public async getAssistant(name?:string){
		if (!name){
			return undefined;
		}
		return this._assistant.getAssistant(name);
	}
}
