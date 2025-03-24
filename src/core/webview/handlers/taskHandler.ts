import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import pWaitFor from 'p-wait-for';

export const taskHandlers = {
	'newTask': handleNewTask,
	'resumeTask': handleResumeTask,
	'clearTask': handleClearTask,
	'showTaskWithId': handleShowTaskWithId,
	'deleteTaskWithId': handleDeleteTaskWithId,
	'exportTaskWithId': handleExportTaskWithId,
	'cancelTask': handleCancelTask,
};

export async function handleNewTask(instance: ClineProvider, message: WebviewMessage) {
	await instance.initClineWithTask(message.text, message.images);
}

export async function handleResumeTask(instance: ClineProvider, message: WebviewMessage) {
	if (instance.cline) {
		const { historyItem } = await instance.getTaskWithId(instance.cline.taskId);
		console.log('[waht] history item', historyItem);
		await instance.initClineWithHistoryItem(Object.assign(historyItem, { newMessage: message.text, newImages: message.images }));
	} else {
		await instance.initClineWithTask(message.text, message.images);
	}
}

export async function handleClearTask(instance: ClineProvider) {
	await instance.clearTask();
	await instance.postStateToWebview();
}

export async function handleShowTaskWithId(instance: ClineProvider, message: WebviewMessage) {
	await instance.showTaskWithId(message.text!);
}

export async function handleDeleteTaskWithId(instance: ClineProvider, message: WebviewMessage) {
	await instance.deleteTaskWithId(message.text!);
}

export async function handleExportTaskWithId(instance: ClineProvider, message: WebviewMessage) {
	await instance.exportTaskWithId(message.text!);
}

export async function handleCancelTask(instance: ClineProvider) {
	if (instance.cline) {
		const { historyItem } = await instance.getTaskWithId(instance.cline.taskId);
		instance.cline.abortTask();
		await pWaitFor(() => instance.cline === undefined || instance.cline.abortComplete, {
			timeout: 3_000,
		}).catch(() => {
			console.error('Failed to abort task');
		});
		await instance.initClineWithHistoryItem(historyItem); // clears task again, so we need to abortTask manually above
		// await instance.postStateToWebview() // new Cline instance will post state when it's ready. having this here sent an empty messages array to webview leading to virtuoso having to reload the entire list
	}
}
