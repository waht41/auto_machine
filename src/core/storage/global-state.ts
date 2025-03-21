import { HistoryItem } from '@/shared/HistoryItem';
import { Memento } from '@core/storage/memo';
import { IGlobalState } from '@core/storage/type';
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
		return this.memento.get(key) as IGlobalState[T];
	}

	async set<T extends  keyof IGlobalState>(key: T, value: IGlobalState[T]): Promise<void> {
		await this.memento.update(key, value);
	}

	async getAll(): Promise<IGlobalState> {
		return this.memento.getAll() as Promise<IGlobalState>;
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
