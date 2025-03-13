import { ApiHandler } from '@/api';
import { ApiStream } from '@/api/transform/stream';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { IApiConversationHistory } from '@core/manager/type';

export class StreamChatManager{
	apiConversationHistory: IApiConversationHistory = [];
	didCompleteReadingStream = false;
	constructor(private api: ApiHandler, private taskDir: string) {
	}

	public resetStream(){
		this.didCompleteReadingStream = false;
	}

	async *attemptApiRequest(): ApiStream {
		const systemPrompt = await SYSTEM_PROMPT();
		// Clean conversation history by:
		// 1. Converting to Anthropic.MessageParam by spreading only the API-required properties
		// 2. Converting image blocks to text descriptions if model doesn't support images
		const cleanConversationHistory = this.convertToConversation();
		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory);
		const iterator = stream[Symbol.asyncIterator]();
		try {
			const firstChunk = await iterator.next();
			yield firstChunk.value;
		} catch (error) {
			throw new Error('API request failed');
		}

		yield* iterator;
	}

	private convertToConversation(){
		return this.apiConversationHistory.map(({ role, content }) => {
			// Handle array content (could contain image blocks)
			if (Array.isArray(content)) {
				if (!this.api.getModel().info.supportsImages) {
					// Convert image blocks to text descriptions
					content = content.map((block) => {
						if (block.type === 'image') {
							// Convert image blocks to text descriptions
							// Note: We can't access the actual image content/url due to API limitations,
							// but we can indicate that an image was present in the conversation
							return {
								type: 'text',
								text: '[Referenced image in conversation]',
							};
						}
						return block;
					});
				}
			}
			return { role, content };
		});
	}

	public getApiConversationHistory(){
		return this.apiConversationHistory;
	}

	public endStream(){
		this.didCompleteReadingStream = true;
	}

	public isStreamComplete(){
		return this.didCompleteReadingStream;
	}
}
