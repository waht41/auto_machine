import {
	anthropicDefaultModelId,
	anthropicModels,
	ApiConfiguration,
	bedrockDefaultModelId,
	bedrockModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	geminiDefaultModelId,
	geminiModels,
	glamaDefaultModelId,
	glamaDefaultModelInfo, mistralDefaultModelId, mistralModels,
	ModelInfo, openAiModelInfoSaneDefaults,
	openAiNativeDefaultModelId,
	openAiNativeModels, openRouterDefaultModelId, openRouterDefaultModelInfo,
	vertexDefaultModelId,
	vertexModels
} from '@/shared/api';

export function normalizeApiConfiguration(apiConfiguration?: ApiConfiguration) {
	const provider = apiConfiguration?.apiProvider || 'anthropic';
	const modelId = apiConfiguration?.apiModelId;

	const getProviderData = (models: Record<string, ModelInfo>, defaultId: string) => {
		let selectedModelId: string;
		let selectedModelInfo: ModelInfo;
		if (modelId && modelId in models) {
			selectedModelId = modelId;
			selectedModelInfo = models[modelId];
		} else {
			selectedModelId = defaultId;
			selectedModelInfo = models[defaultId];
		}
		return { selectedProvider: provider, selectedModelId, selectedModelInfo };
	};
	switch (provider) {
		case 'anthropic':
			return getProviderData(anthropicModels, anthropicDefaultModelId);
		case 'bedrock':
			return getProviderData(bedrockModels, bedrockDefaultModelId);
		case 'vertex':
			return getProviderData(vertexModels, vertexDefaultModelId);
		case 'gemini':
			return getProviderData(geminiModels, geminiDefaultModelId);
		case 'deepseek':
			return getProviderData(deepSeekModels, deepSeekDefaultModelId);
		case 'openai-native':
			return getProviderData(openAiNativeModels, openAiNativeDefaultModelId);
		case 'glama':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.glamaModelId || glamaDefaultModelId,
				selectedModelInfo: apiConfiguration?.glamaModelInfo || glamaDefaultModelInfo,
			};
		case 'mistral':
			return getProviderData(mistralModels, mistralDefaultModelId);
		case 'openrouter':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openRouterModelId || openRouterDefaultModelId,
				selectedModelInfo: apiConfiguration?.openRouterModelInfo || openRouterDefaultModelInfo,
			};
		case 'openai':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openAiModelId || '',
				selectedModelInfo: apiConfiguration?.openAiCustomModelInfo || openAiModelInfoSaneDefaults,
			};
		case 'ollama':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.ollamaModelId || '',
				selectedModelInfo: openAiModelInfoSaneDefaults,
			};
		case 'lmstudio':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.lmStudioModelId || '',
				selectedModelInfo: openAiModelInfoSaneDefaults,
			};
		case 'vscode-lm':
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.vsCodeLmModelSelector
					? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
					: '',
				selectedModelInfo: {
					...openAiModelInfoSaneDefaults,
					supportsImages: false, // VSCode LM API currently doesn't support images
				},
			};
		default:
			return getProviderData(anthropicModels, anthropicDefaultModelId);
	}
}

export const formatPrice = (price: number) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(price);
};

export function getGlamaAuthUrl(uriScheme?: string) {
	const callbackUrl = `${uriScheme || 'vscode'}://rooveterinaryinc.roo-cline/glama`;

	return `https://glama.ai/oauth/authorize?callback_url=${encodeURIComponent(callbackUrl)}`;
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${uriScheme || 'vscode'}://rooveterinaryinc.roo-cline/openrouter`;
}
