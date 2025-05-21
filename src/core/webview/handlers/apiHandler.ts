import {
	ApiConfigurationMessage,
	RefreshOpenAiModelsMessage,
	RequestLmStudioModelsMessage,
	RequestOllamaModelsMessage,
	UpsertApiConfigurationMessage
} from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';

export const apiHandlers = {
	apiConfiguration: handleApiConfiguration,
	upsertApiConfiguration: handleUpsertApiConfiguration,
	requestOllamaModels: handleRequestOllamaModels,
	requestLmStudioModels: handleRequestLmStudioModels,
	requestVsCodeLmModels: handleRequestVsCodeLmModels,
	refreshGlamaModels: handleRefreshGlamaModels,
	refreshOpenRouterModels: handleRefreshOpenRouterModels,
	refreshOpenAiModels: handleRefreshOpenAiModels,
};

/**
 * 处理 API 配置更新
 */
export async function handleApiConfiguration(instance: ClineProvider, message: ApiConfigurationMessage) {
	if (message.apiConfiguration) {
		await instance.stateService.updateApiConfig(message.apiConfiguration);
	}
	await instance.postStateToWebview();
}

/**
 * 创建或更新 API 配置
 */
export async function handleUpsertApiConfiguration(instance: ClineProvider, message: UpsertApiConfigurationMessage) {
	if (message.text && message.apiConfiguration) {
		try {
			await instance.stateService.updateApiConfig(message.apiConfiguration);
			await instance.postStateToWebview();
		} catch (error) {
			console.error('Error create new api configuration:', error);
			vscode.window.showErrorMessage('Failed to create api configuration');
		}
	}
}

/**
 * 请求 Ollama 模型列表
 */
export async function handleRequestOllamaModels(instance: ClineProvider, message: RequestOllamaModelsMessage) {
	const ollamaModels = await instance.apiManager.getOllamaModels(message.text);
	await instance.messageService.postMessageToWebview({ type: 'ollamaModels', ollamaModels });
}

/**
 * 请求 LmStudio 模型列表
 */
export async function handleRequestLmStudioModels(instance: ClineProvider, message: RequestLmStudioModelsMessage) {
	const lmStudioModels = await instance.apiManager.getLmStudioModels(message.text);
	await instance.messageService.postMessageToWebview({ type: 'lmStudioModels', lmStudioModels });
}

/**
 * 请求 VsCode LM 模型列表
 */
export async function handleRequestVsCodeLmModels(instance: ClineProvider) {
	const vsCodeLmModels = await instance.getVsCodeLmModels();
	await instance.messageService.postMessageToWebview({ type: 'vsCodeLmModels', vsCodeLmModels });
}

/**
 * 刷新 Glama 模型列表
 */
export async function handleRefreshGlamaModels(instance: ClineProvider) {
	await instance.apiManager.refreshGlamaModels();
}

/**
 * 刷新 OpenRouter 模型列表
 */
export async function handleRefreshOpenRouterModels(instance: ClineProvider) {
	await instance.apiManager.refreshOpenRouterModels();
}

/**
 * 刷新 OpenAI 模型列表
 */
export async function handleRefreshOpenAiModels(instance: ClineProvider, message: RefreshOpenAiModelsMessage) {
	if (message?.values?.baseUrl && message?.values?.apiKey) {
		const openAiModels = await instance.apiManager.getOpenAiModels(
			message?.values?.baseUrl,
			message?.values?.apiKey,
		);
		await instance.messageService.postMessageToWebview({ type: 'openAiModels', openAiModels });
	}
}
