import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';

export const chatHandlers = {
	'deleteMessage': handleDeleteMessage,
	'answer': handleAnswer,
};

/**
 * Handle deleting a message
 */
export async function handleDeleteMessage() {
	console.error('Delete message not implemented');
}

/**
 * Handle an answer
 */
export async function handleAnswer(instance: ClineProvider, message: WebviewMessage) {
	instance.cline?.receiveAnswer(message.payload);
}
