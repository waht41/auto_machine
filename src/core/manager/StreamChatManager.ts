import { ApiHandler } from '@/api';
import { ApiStream, ApiStreamChunk } from '@/api/transform/stream';
import { ClineApiReqInfo } from '@/shared/ExtensionMessage';
import { parseBlocks } from '@core/assistant-message/parse-assistant-message';
import { calculateApiCost } from '@/utils/cost';
import { McpHub } from '@operation/MCP';
import pWaitFor from 'p-wait-for';
import { SYSTEM_PROMPT } from '@core/prompts/system';
import { truncateHalfConversation } from '@core/sliding-window';
import delay from 'delay';
import { serializeError } from 'serialize-error';
import { Anthropic } from '@anthropic-ai/sdk';

export class StreamChatManager{
	currentStreamingContentIndex = 0;
	assistantMessageContent = [];
	didCompleteReadingStream = false;
	userMessageContent = [];
	userMessageContentReady = false;
	didRejectTool = false;
	didGetNewMessage = false;
	presentAssistantMessageLocked = false;
	presentAssistantMessageHasPendingUpdates = false;
	apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = [];
	constructor(private api: ApiHandler) {
	}

	public resetStream(){
		this.currentStreamingContentIndex = 0;
		this.assistantMessageContent = [];
		this.didCompleteReadingStream = false;
		this.userMessageContent = [];
		this.userMessageContentReady = false;
		this.didRejectTool = false;
		this.didGetNewMessage = false;
		this.presentAssistantMessageLocked = false;
		this.presentAssistantMessageHasPendingUpdates = false;
	}

	async handleChunk(chunk: ApiStreamChunk, apiReq:ClineApiReqInfo, reasoningMessage: string, assistantMessage: string) {
		switch (chunk.type) {
			case 'reasoning':
				reasoningMessage += chunk.text;
				return {chunkType: 'reasoning', reasoningMessage};
				await this.say('reasoning', reasoningMessage, undefined, true);
				break;
			case 'usage':  //todo waht 不确定其它api回的是不是最终结果（腾讯云是）

				apiReq.tokensIn = chunk.inputTokens;
				apiReq.tokensOut = chunk.outputTokens;
				apiReq.cacheWrites = chunk.cacheWriteTokens ?? 0;
				apiReq.cacheReads = chunk.cacheReadTokens ?? 0;
				apiReq.cost = chunk.totalCost;
				return {};
				break;
			case 'text':
				assistantMessage += chunk.text;
				console.log('返回的信息: ', chunk.text);
				// parse raw assistant message into content blocks
				const prevLength = this.assistantMessageContent.length;
				this.assistantMessageContent = parseBlocks(assistantMessage);
				const replacing = this.assistantMessageContent.length <= prevLength;
				if (this.assistantMessageContent.length > prevLength) {
					this.userMessageContentReady = false; // new content we need to present, reset to false in case previous content set this to true
				}
				// present content to user
				this.handleAssistantMessage(replacing);
				break;
		}
		return {reasoningMessage, assistantMessage};
	}

	async handleStreamingMessage(previousApiReqIndex: number, lastApiReqIndex: number) {

		const apiReq: ClineApiReqInfo = JSON.parse(this.clineMessages[lastApiReqIndex].text || '{}');
		apiReq.tokensIn = 0;
		apiReq.tokensOut = 0;
		apiReq.cacheWrites = 0;
		apiReq.cacheReads = 0;

		await this.resetStream();

		const stream = this.attemptApiRequest(previousApiReqIndex); // yields only if the first chunk is successful, otherwise will allow the user to retry the request (most likely due to rate limit error, which gets thrown on the first chunk)
		let assistantMessage = '';
		let reasoningMessage = '';
		try {
			for await (const chunk of stream) {
				const prop = await this.handleChunk(chunk, apiReq, reasoningMessage, assistantMessage);
				reasoningMessage = prop.reasoningMessage;
				assistantMessage = prop.assistantMessage;

				apiReq.cost = apiReq.cost ??
          calculateApiCost(this.api.getModel().info, apiReq.tokensIn, apiReq.tokensOut, apiReq.cacheWrites, apiReq.cacheReads);

				if (this.abort) {
					console.log('aborting stream...');
					if (!this.abandoned) {
						// only need to gracefully abort if this instance isn't abandoned (sometimes openrouter stream hangs, in which case this would affect future instances of cline)
						await this.abortStream('user_cancelled',assistantMessage,apiReq,lastApiReqIndex);
					}
					break; // aborts the stream
				}

				if (this.didRejectTool) {
					// userContent has a tool rejection, so interrupt the assistant's response to present the user's feedback
					assistantMessage += '\n\n[Response interrupted by user feedback]';
					// this.userMessageContentReady = true // instead of setting this premptively, we allow the present iterator to finish and set userMessageContentReady when its ready
					break;
				}

			}
		} catch (error) {
			await this.handleStreamError(error, assistantMessage, apiReq, lastApiReqIndex);
		}

		// need to call here in case the stream was aborted
		if (this.abort) {
			throw new Error('Roo Code instance aborted');
		}

		this.didCompleteReadingStream = true;

		// set any blocks to be complete to allow presentAssistantMessage to finish and set userMessageContentReady to true
		// (could be a text block that had no subsequent tool uses, or a text block at the very end, or an invalid tool use, etc. whatever the case, presentAssistantMessage relies on these blocks either to be completed or the user to reject a block in order to proceed and eventually set userMessageContentReady to true)
		const partialBlocks = this.assistantMessageContent.filter((block) => block.partial);
		partialBlocks.forEach((block) => {
			block.partial = false;
		});
		if (partialBlocks.length > 0) {
			await this.handleAssistantMessage(); // if there is content to update then it will complete and update this.userMessageContentReady to true, which we pwaitfor before making the next request. all this is really doing is presenting the last partial message that we just set to complete
		}

		this.updateApiReq(apiReq, lastApiReqIndex);
		await this.saveClineMessages();
		await this.providerRef.deref()?.postStateToWebview();

		return this.handleAssistantMessageComplete(assistantMessage);
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
}
