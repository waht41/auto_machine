import { GlobalState } from '@core/storage/global-state';
import path from 'path';
import { configPath } from '@core/storage/common';
import { SecretStorage } from '@core/storage/secret';
import { SecretKey } from '@core/webview/type';
import { ApiConfiguration } from '@/shared/api';
import { IGlobalState, secretKeys } from '@core/storage/type';
import { GlobalFileNames } from '@core/webview/const';

export class ConfigService {
	private static _instance: ConfigService;
	private _secrets = new SecretStorage(path.join(configPath, GlobalFileNames.secrets));
	private _state = new GlobalState(path.join(configPath, GlobalFileNames.globalState));

	private constructor() {
	}

	public static getInstance(): ConfigService {
		if (!ConfigService._instance) {
			ConfigService._instance = new ConfigService();
		}
		return ConfigService._instance;
	}

	public async getConfig() : Promise<IGlobalState> {
		const [globalStates, secrets] = await Promise.all([
			this.getGlobalStates(),
			this.getSecrets()
		]);
		globalStates.apiConfiguration = {...globalStates.apiConfiguration, ...secrets};
		return globalStates;
	}

	public async getApiConfig(): Promise<ApiConfiguration> {
		const apiConfig = this._state.get('apiConfiguration');
		const secrets = await this.getSecrets();
		return { ...apiConfig, ...secrets };
	}

	public async getGlobalStates() {
		return this._state.getAll();
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
		await this._state.set('apiConfiguration', apiConfigWithoutSecrets);
	}

	public async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this._secrets.set(key, value);
		}
	}

	public async deleteSecret(key: SecretKey) {
		await this._secrets.remove(key);
	}

	public async setGlobalState<T extends keyof IGlobalState>(key: T, value: IGlobalState[T]) {
		await this._state.set(key, value);
	}

	public async getGlobalState(key: keyof IGlobalState) {
		return this._state.get(key);
	}

	public getState() {
		return this._state;
	}
}
