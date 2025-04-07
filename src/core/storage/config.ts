import { Memento } from '@core/storage/memo';
import { IConfig } from '@core/storage/type';
import { defaultModeSlug } from '@/shared/modes';
import path from 'path';
import { getUserDataPath } from '@core/storage/common';
export class Config {
	private memento: Memento;
	constructor(statePath: string) {
		this.memento = new Memento(statePath);
	}

	get<T extends keyof IConfig>(key: T) {
		return this.memento.get(key) as IConfig[T] ?? defaultConfig[key];
	}

	async set<T extends  keyof IConfig>(key: T, value: IConfig[T]): Promise<void> {
		await this.memento.update(key, value);
	}

	async getAll(): Promise<IConfig> {
		return {...defaultConfig, ...this.memento.getAll() as IConfig};
	}

	async setAll(state: IConfig): Promise<void> {
		for (const key of Object.keys(state) as Array<keyof IConfig>) {
			await this.set(key, state[key]);
		}
	}

	keys(): readonly string[] {
		return this.memento.keys();
	}
}

const defaultConfig : IConfig = {
	apiConfiguration: {
		apiProvider: 'openrouter',
	},
	alwaysAllowMcp: false,
	soundEnabled: false,
	browserViewportSize: '900x600',
	screenshotQuality: 75,
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
	autoApprovalEnabled: false,
	taskDirRoot: path.join(getUserDataPath(), 'tasks'),
};