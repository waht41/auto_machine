import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';

export const chatHandlers = {
	'deleteMessage': handleDeleteMessage,
	'answer': handleAnswer,
};

/**
 * Handle deleting a message
 */
export async function handleDeleteMessage(instance: ClineProvider, message: WebviewMessage) {
	const answer = await vscode.window.showInformationMessage(
		'What would you like to delete?',
		{ modal: true },
		'Just this message',
		'This and all subsequent messages',
	);
    
	if (
		(answer === 'Just this message' || answer === 'This and all subsequent messages') &&
        instance.cline &&
        typeof message.value === 'number' &&
        message.value
	) {
		const timeCutoff = message.value - 1000; // 1 second buffer before the message to delete
		const messageIndex = instance.cline.clineMessages.findIndex(
			(msg) => msg.ts && msg.ts >= timeCutoff,
		);
		const apiConversationHistoryIndex = instance.cline.apiConversationHistory.findIndex(
			(msg) => msg.ts && msg.ts >= timeCutoff,
		);

		if (messageIndex !== -1) {
			const { historyItem } = await instance.getTaskWithId(instance.cline.taskId);

			if (answer === 'Just this message') {
				// Find the next user message first
				const nextUserMessage = instance.cline.clineMessages
					.slice(messageIndex + 1)
					.find((msg) => msg.type === 'say' && msg.say === 'user_feedback');

				// Handle UI messages
				if (nextUserMessage) {
					// Find absolute index of next user message
					const nextUserMessageIndex = instance.cline.clineMessages.findIndex(
						(msg) => msg === nextUserMessage,
					);
					// Keep messages before current message and after next user message
					await instance.cline.overwriteClineMessages([
						...instance.cline.clineMessages.slice(0, messageIndex),
						...instance.cline.clineMessages.slice(nextUserMessageIndex),
					]);
				} else {
					// If no next user message, keep only messages before current message
					await instance.cline.overwriteClineMessages(
						instance.cline.clineMessages.slice(0, messageIndex),
					);
				}

				// Handle API messages
				if (apiConversationHistoryIndex !== -1) {
					if (nextUserMessage && nextUserMessage.ts) {
						// Keep messages before current API message and after next user message
						await instance.cline.overwriteApiConversationHistory([
							...instance.cline.apiConversationHistory.slice(
								0,
								apiConversationHistoryIndex,
							),
							...instance.cline.apiConversationHistory.filter(
								(msg) => msg.ts && msg.ts >= nextUserMessage.ts,
							),
						]);
					} else {
						// If no next user message, keep only messages before current API message
						await instance.cline.overwriteApiConversationHistory(
							instance.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
						);
					}
				}
			} else if (answer === 'This and all subsequent messages') {
				// Delete this message and all that follow
				await instance.cline.overwriteClineMessages(
					instance.cline.clineMessages.slice(0, messageIndex),
				);
				if (apiConversationHistoryIndex !== -1) {
					await instance.cline.overwriteApiConversationHistory(
						instance.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
					);
				}
			}

			await instance.initClineWithHistoryItem(historyItem);
		}
	}
}

/**
 * Handle an answer
 */
export async function handleAnswer(instance: ClineProvider, message: WebviewMessage) {
	instance.cline?.receiveAnswer(message.payload);
}
