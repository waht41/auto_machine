import { Config } from '@core/storage/config';
import path from 'path';
import { configPath } from '@core/storage/common';
import { SecretStorage } from '@core/storage/secret';
import { SecretKey } from '@core/webview/type';
import { ApiConfiguration } from '@/shared/api';
import { IConfig, secretKeys } from '@core/storage/type';
import { GlobalFileNames } from '@core/webview/const';
import { TaskHistoryStorage } from '@core/storage/taskHistory';
import { HistoryItem } from '@/shared/HistoryItem';

export class ConfigService {
	private static _instance: ConfigService;
	private _secrets = new SecretStorage(path.join(configPath, GlobalFileNames.secrets));
	private _config = new Config(path.join(configPath, GlobalFileNames.globalState));
	private _taskHistory: TaskHistoryStorage = new TaskHistoryStorage(this._config.get('taskDirRoot'));

	private constructor() {
	}

	async init() {
		await this._taskHistory.init();
	}

	public static getInstance(): ConfigService {
		if (!ConfigService._instance) {
			ConfigService._instance = new ConfigService();
		}
		return ConfigService._instance;
	}

	public async getConfig() : Promise<IConfig> {
		const [globalStates, secrets] = await Promise.all([
			this.getAllConfig(),
			this.getSecrets()
		]);
		globalStates.apiConfiguration = {...globalStates.apiConfiguration, ...secrets};
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

	public async setGlobalState<T extends keyof IConfig>(key: T, value: IConfig[T]) {
		await this._config.set(key, value);
	}

	public async getGlobalState(key: keyof IConfig) {
		return this._config.get(key);
	}

	public getInternalConfig() {
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
}
