import { HistoryItem } from "@/shared/HistoryItem";
import { Memento } from "@core/record/memo";
export class GlobalState {
    private memento: Memento
    constructor(statePath: string) {
        this.memento = new Memento(statePath)
    }
    async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
        const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
        const existingItemIndex = history.findIndex((h) => h.id === item.id)

        if (existingItemIndex !== -1) {
            history[existingItemIndex] = item
        } else {
            history.push(item)
        }
        await this.updateGlobalState("taskHistory", history)
        return history
    }

    async getGlobalState<T>(key: string): Promise<T | undefined> {
        return this.memento.get(key)
    }

    async updateGlobalState(key: string, value: any): Promise<void> {
        return this.memento.update(key, value)
    }

    async getAll(): Promise<any> {
        return this.memento.getAll()
    }

    keys(): readonly string[] {
        return this.memento.keys()
    }
}
