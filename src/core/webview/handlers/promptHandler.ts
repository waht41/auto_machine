import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';
import { singleCompletionHandler } from '@/utils/single-completion-handler';
import { supportPrompt } from '@/shared/support-prompt';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { ApiConfiguration } from '@/shared/api';

export const promptHandlers = {
	'updateSupportPrompt': handleUpdateSupportPrompt,
	'resetSupportPrompt': handleResetSupportPrompt,
	'updatePrompt': handleUpdatePrompt,
	'enhancePrompt': handleEnhancePrompt,
	'getSystemPrompt': handleGetSystemPrompt,
};

export async function handleUpdateSupportPrompt(instance: ClineProvider, message: WebviewMessage) {
	try {
		if (Object.keys(message?.values ?? {}).length === 0) {
			return;
		}

		const existingPrompts = (await instance.getGlobalState('customSupportPrompts')) || {};

		const updatedPrompts = {
			...existingPrompts,
			...message.values,
		};

		await instance.updateConfig('customSupportPrompts', updatedPrompts);
		await instance.postStateToWebview();
	} catch (error) {
		console.error('Error update support prompt:', error);
		vscode.window.showErrorMessage('Failed to update support prompt');
	}
}

export async function handleResetSupportPrompt(instance: ClineProvider, message: WebviewMessage) {
	try {
		if (!message?.text) {
			return;
		}

		const existingPrompts = ((await instance.getGlobalState('customSupportPrompts')) ||
            {}) as Record<string, unknown>;

		const updatedPrompts = {
			...existingPrompts,
		};

		updatedPrompts[message.text] = undefined;

		await instance.updateConfig('customSupportPrompts', updatedPrompts);
		await instance.postStateToWebview();
	} catch (error) {
		console.error('Error reset support prompt:', error);
		vscode.window.showErrorMessage('Failed to reset support prompt');
	}
}

export async function handleUpdatePrompt(instance: ClineProvider, message: WebviewMessage) {
	if (message.promptMode && message.customPrompt !== undefined) {
		const existingPrompts = (await instance.getGlobalState('customModePrompts')) || {};

		const updatedPrompts = {
			...existingPrompts,
			[message.promptMode]: message.customPrompt,
		};

		await instance.updateConfig('customModePrompts', updatedPrompts);

		// Get current state and explicitly include customModePrompts
		const currentState = await instance.getState();

		const stateWithPrompts = {
			...currentState,
			customModePrompts: updatedPrompts,
		};

		// Post state with prompts
		await instance.messageService.postMessageToWebview({
			type: 'state',
			state: stateWithPrompts,
		});
	}
}

export async function handleEnhancePrompt(instance: ClineProvider, message: WebviewMessage) {
	if (message.text) {
		try {
			const {
				apiConfiguration,
				customSupportPrompts,
			} = await instance.getState();

			// Try to get enhancement config first, fall back to current config
			const configToUse: ApiConfiguration = apiConfiguration;
			const enhancedPrompt = await singleCompletionHandler(
				configToUse,
				supportPrompt.create(
					'ENHANCE',
					{
						userInput: message.text,
					},
					customSupportPrompts,
				),
			);

			await instance.messageService.postMessageToWebview({
				type: 'enhancedPrompt',
				text: enhancedPrompt,
			});
		} catch (error) {
			console.error('Error enhancing prompt:', error);
			vscode.window.showErrorMessage('Failed to enhance prompt');
			await instance.messageService.postMessageToWebview({
				type: 'enhancedPrompt',
			});
		}
	}
}

export async function handleGetSystemPrompt(instance: ClineProvider, message: WebviewMessage) {
	try {
		const systemPrompt = await SYSTEM_PROMPT();

		await instance.messageService.postMessageToWebview({
			type: 'systemPrompt',
			text: systemPrompt,
			mode: message.mode,
		});
	} catch (error) {
		console.error('Error getting system prompt:', error);
		vscode.window.showErrorMessage('Failed to get system prompt');
	}
}