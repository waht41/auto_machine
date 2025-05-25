import { Memento } from '@core/storage/memo';
import { AssistantConfig, AssistantStructure } from '@core/storage/type';

export class Assistant {
	private memento: Memento;
	constructor(statePath: string) {
		this.memento = new Memento(statePath);
	}

	get<T extends keyof AssistantConfig>(key: T) {
		return this.memento.get(key) as AssistantConfig[T];
	}

	async set<T extends  keyof AssistantConfig>(key: T, value: AssistantConfig[T]): Promise<void> {
		await this.memento.update(key, value);
	}

	keys(): readonly string[] {
		return this.memento.keys();
	}

	async upsertAssistant(assistant: AssistantStructure){
		const assistants = this.memento.get('assistants') as AssistantStructure[] || [];

		// Check if assistant with the same name already exists
		const existingIndex = assistants.findIndex(a => a.id === assistant.id);

		if (existingIndex !== -1) {
			// Update existing assistant
			assistants[existingIndex] = assistant;
		} else {
			// Add new assistant
			assistants.push(assistant);
		}

		await this.memento.update('assistants', assistants);
	}

	async removeAssistant(assistantId: string){
		const assistants = this.memento.get('assistants') as AssistantStructure[] || [];
		const filteredAssistants = assistants.filter(assistant => assistant.id !== assistantId);
		await this.memento.update('assistants', filteredAssistants);
	}

	async getAssistant(assistantId: string) {
		const assistants = this.memento.get('assistants') as AssistantStructure[] || [];
		return assistants.find(assistant => assistant.id === assistantId);
	}
}
