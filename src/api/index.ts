import { Anthropic } from '@anthropic-ai/sdk';
import { GlamaHandler } from './providers/glama';
import { ApiConfiguration, ModelInfo } from '../shared/api';
import { AnthropicHandler } from './providers/anthropic';
import { AwsBedrockHandler } from './providers/bedrock';
import { OpenRouterHandler } from './providers/openrouter';
import { VertexHandler } from './providers/vertex';
import { OpenAiHandler } from './providers/openai';
import { OllamaHandler } from './providers/ollama';
import { LmStudioHandler } from './providers/lmstudio';
import { GeminiHandler } from './providers/gemini';
import { OpenAiNativeHandler } from './providers/openai-native';
import { DeepSeekHandler } from './providers/deepseek';
import { MistralHandler } from './providers/mistral';
import { VsCodeLmHandler } from './providers/vscode-lm';
import { ApiStream } from './transform/stream';

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandler {
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream
	getModel(): { id: string; info: ModelInfo }
}

export function buildApiHandler(configuration: ApiConfiguration): ApiHandler {
	const { apiProvider, ...options } = configuration;
	switch (apiProvider) {
		case 'anthropic':
			return new AnthropicHandler(options);
		case 'glama':
			return new GlamaHandler(options);
		case 'openrouter':
			return new OpenRouterHandler(options);
		case 'bedrock':
			return new AwsBedrockHandler(options);
		case 'vertex':
			return new VertexHandler(options);
		case 'openai':
			return new OpenAiHandler(options);
		case 'ollama':
			return new OllamaHandler(options);
		case 'lmstudio':
			return new LmStudioHandler(options);
		case 'gemini':
			return new GeminiHandler(options);
		case 'openai-native':
			return new OpenAiNativeHandler(options);
		case 'deepseek':
			return new DeepSeekHandler(options);
		case 'vscode-lm':
			return new VsCodeLmHandler(options);
		case 'mistral':
			return new MistralHandler(options);
		default:
			return new AnthropicHandler(options);
	}
}
