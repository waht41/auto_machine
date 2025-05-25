import { RemoveAssistantMessage, UpsertAssistantMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';

export const assistantHandlers = {
	getAssistants: handleGetAssistants,
	upsertAssistant: handleUpsertAssistant,
	removeAssistant: handleRemoveAssistant,
};

export async function handleGetAssistants(instance: ClineProvider) {
	await instance.postStateToWebview();
}

export async function handleUpsertAssistant(instance: ClineProvider, message: UpsertAssistantMessage) {
	if (message.assistant) {
		await instance.stateService.upsertAssistant(message.assistant);
		await instance.postStateToWebview();
	}
}

export async function handleRemoveAssistant(instance: ClineProvider, message: RemoveAssistantMessage) {
	if (message.assistantId) {
		await instance.stateService.removeAssistant(message.assistantId);
		await instance.postStateToWebview();
	}
}
