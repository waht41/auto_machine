import { ClineMessage } from './ExtensionMessage';
import { ApiMetrics } from '@/shared/type';

/**
 * Calculates API metrics from an array of ClineMessages.
 *
 * This function processes 'api_req_started' messages that have been combined with their
 * corresponding 'api_req_finished' messages by the combineApiRequests function.
 * It extracts and sums up the tokensIn, tokensOut, cacheWrites, cacheReads, and cost from these messages.
 *
 * @param messages - An array of ClineMessage objects to process.
 * @returns An ApiMetrics object containing totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, and totalCost.
 *
 * @example
 * const messages = [
 *   { type: "say", say: "api_req_started", text: '{"request":"GET /api/data","tokensIn":10,"tokensOut":20,"cost":0.005}', ts: 1000 }
 * ];
 * const { totalTokensIn, totalTokensOut, totalCost } = getApiMetrics(messages);
 * // Result: { totalTokensIn: 10, totalTokensOut: 20, totalCost: 0.005 }
 */
export function getApiMetrics(messages: ClineMessage[]): ApiMetrics {
	const result: ApiMetrics = {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: undefined,
		totalCacheReads: undefined,
		totalCost: 0,
		contextTokens: 0,
	};

	// Find the last api_req_started message that has valid token information
	const lastApiReq = [...messages].reverse().find((message) => {
		if (message.type === 'say' && message.say === 'api_req_started' && message.text) {
			try {
				const parsedData = JSON.parse(message.text);
				return typeof parsedData.tokensIn === 'number' && typeof parsedData.tokensOut === 'number';
			} catch {
				return false;
			}
		}
		return false;
	});

	messages.forEach((message) => {
		if (message.type === 'say' && message.say === 'api_req_started' && message.text) {
			try {
				const parsedData = JSON.parse(message.text);
				const { tokensIn, tokensOut, cacheWrites, cacheReads, cost } = parsedData;

				if (typeof tokensIn === 'number') {
					result.totalTokensIn += tokensIn;
				}
				if (typeof tokensOut === 'number') {
					result.totalTokensOut += tokensOut;
				}
				if (typeof cacheWrites === 'number') {
					result.totalCacheWrites = (result.totalCacheWrites ?? 0) + cacheWrites;
				}
				if (typeof cacheReads === 'number') {
					result.totalCacheReads = (result.totalCacheReads ?? 0) + cacheReads;
				}
				if (typeof cost === 'number') {
					result.totalCost += cost;
				}

				// If this is the last api request, use its tokens for context size
				if (message === lastApiReq) {
					// Only update context tokens if both input and output tokens are non-zero
					if (tokensIn > 0 && tokensOut > 0) {
						result.contextTokens = tokensIn + tokensOut;
					}
				}
			} catch (error) {
				console.error('Error parsing JSON:', error);
			}
		}
	});

	return result;
}
