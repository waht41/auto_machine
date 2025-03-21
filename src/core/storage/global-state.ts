import { HistoryItem } from '@/shared/HistoryItem';
import { Memento } from '@core/storage/memo';
import { IGlobalState } from '@core/storage/type';
import { defaultModeSlug } from '@/shared/modes';
export class GlobalState {
	private memento: Memento;
	constructor(statePath: string) {
		this.memento = new Memento(statePath);
	}
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = this.get('taskHistory') || [];
		const existingItemIndex = history.findIndex((h) => h.id === item.id);

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item;
		} else {
			history.push(item);
		}
		await this.set('taskHistory', history);
		return history;
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

export const defaultState : IGlobalState = {
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
	taskDirRoot: './tasks'
};