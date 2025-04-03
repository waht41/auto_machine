import { Memento } from '@core/storage/memo';
import { IGlobalState } from '@core/storage/type';
import { defaultModeSlug } from '@/shared/modes';
export class GlobalState {
	private memento: Memento;
	constructor(statePath: string) {
		this.memento = new Memento(statePath);
	}

	get<T extends keyof IGlobalState>(key: T) {
		return this.memento.get(key) as IGlobalState[T] ?? defaultState[key];
	}

	async set<T extends  keyof IGlobalState>(key: T, value: IGlobalState[T]): Promise<void> {
		await this.memento.update(key, value);
	}

	async getAll(): Promise<IGlobalState> {
		return {...defaultState, ...this.memento.getAll() as IGlobalState};
	}

	async setAll(state: IGlobalState): Promise<void> {
		for (const key of Object.keys(state) as Array<keyof IGlobalState>) {
			await this.set(key, state[key]);
		}
	}

	keys(): readonly string[] {
		return this.memento.keys();
	}
}

const defaultState : IGlobalState = {
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
	taskDirRoot: './tasks'
};