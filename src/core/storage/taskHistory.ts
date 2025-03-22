import { HistoryItem } from '@/shared/HistoryItem';
import fs from 'fs/promises';
import path from 'path';
import { GlobalFileNames } from '@core/webview/const';
import logger from '@/utils/logger';

export class TaskHistoryStorage {
	private taskHistory: HistoryItem[] = [];
	private readonly taskHistoryPath: string;
	constructor(private taskDirRoot: string) {
		this.taskHistoryPath = path.join(this.taskDirRoot, GlobalFileNames.taskHistory);
	}

	async init() {
		await fs.mkdir(this.taskDirRoot, {recursive: true});
		await this.getSavedTaskHistory();
	}

	async addTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = this.taskHistory;
		const existingItemIndex = history.findIndex((h) => h.id === item.id);

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item;
		} else {
			history.push(item);
		}
		await this.saveTaskHistory();
		return history;
	}

	async deleteTaskHistory(id: string): Promise<void> {
		this.taskHistory = this.taskHistory?.filter((task) => task.id !== id);
		await this.saveTaskHistory();
	}

	public getTaskHistory() {
		return this.taskHistory;
	}

	private async getSavedTaskHistory(){
		try {
			const taskHistory = await fs.readFile(this.taskHistoryPath, 'utf-8');
			this.taskHistory = JSON.parse(taskHistory);
		} catch (error) {
			this.taskHistory = [];
		}
	}

	private async saveTaskHistory(){
		try {
			await fs.writeFile(this.taskHistoryPath, JSON.stringify(this.taskHistory));
		} catch (error) {
			logger.error('Error saving task history',error);
			console.error(error);
		}
	}


}