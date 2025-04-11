import type { ClineProvider } from '@core/webview/ClineProvider';
import { WebviewMessage } from '@/shared/WebviewMessage';
import logger from '@/utils/logger';

export const clineHandler = {
	'setTaskId': handleSetTaskId,
};

export async function handleSetTaskId(instance: ClineProvider, message: WebviewMessage) {
	if (message.type !== 'setTaskId') {
		logger.error('handleSetTaskId error wrong type', message);
		return;
	}
	await instance.switchCline(message.taskId);
}