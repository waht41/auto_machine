import { GlobalState } from '@core/storage/global-state';
import path from 'path';
import { configPath } from '@core/storage/common';
import { SecretStorage } from '@core/storage/secret';
import { GlobalStateKey, SecretKey } from '@core/webview/type';
import { ApiConfiguration } from '@/shared/api';
import { IGlobalState, secretKeys } from '@core/storage/type';
import { defaultModeSlug } from '@/shared/modes';
import { GlobalFileNames } from '@core/webview/const';

const defaultApiConfig = {
	apiConfiguration: {
		apiProvider: 'openrouter',
	},
	alwaysAllowMcp: false,
	soundEnabled: false,
	diffEnabled: true,
	browserViewportSize: '900x600',
	screenshotQuality: 75,
	fuzzyMatchThreshold: 1.0,
	writeDelayMs: 1000,
	terminalOutputLineLimit: 500,
	mode: defaultModeSlug,
	preferredLanguage: 'en',
	mcpEnabled: true,
	requestDelaySeconds: 10,
	currentApiConfigName: 'default',
	listApiConfigMeta: [],
	modeApiConfigs: {},
	customModePrompts: {},
	customSupportPrompts: {},
	experimentalDiffStrategy: false,
	autoApprovalEnabled: false,
};

export class ConfigService {
	private static _instance: ConfigService;
	private _secrets = new SecretStorage(path.join(configPath, GlobalFileNames.secrets));

	private constructor(private _state: GlobalState) {
	}

	public static getInstance(state: GlobalState): ConfigService {
		if (!ConfigService._instance) {
			ConfigService._instance = new ConfigService(state);
		}
		return ConfigService._instance;
	}

	public async getConfig() : Promise<IGlobalState> {
		const [globalStates, secrets] = await Promise.all([
			this.getGlobalStates(),
			this.getSecrets()
		]);
		globalStates.apiConfiguration = {...globalStates.apiConfiguration, ...secrets};
		return {...defaultApiConfig, ...globalStates};
	}

	public async getApiConfig(): Promise<ApiConfiguration> {
		const apiConfig = await this._state.get<ApiConfiguration>('apiConfiguration');
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

	public async setGlobalState(key: GlobalStateKey, value: unknown) {
		await this._state.set(key, value);
	}

	public async getGlobalState(key: GlobalStateKey) {
		return this._state.get(key);
	}

	public getState() {
		return this._state;
	}
}
