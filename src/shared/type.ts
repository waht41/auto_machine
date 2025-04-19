import { ClineMessage } from '@/shared/ExtensionMessage';

export type ParallelProp = {
	clines: ClineIdentifier[];
}

export type ClineIdentifier = {task:string, id:string, status:ClineStatus};
export type ClineStatus = 'running' | 'error' | 'completed' | 'pending';
export type SharedClineMessage = {
	type: 'clineMessage';
	id: string;
	clineMessage: ClineMessage[]
} | {
	type: 'partialMessage';
	id: string;
	partialMessage: ClineMessage
}

export interface ApiMetrics {
	totalTokensIn: number;
	totalTokensOut: number;
	totalCacheWrites?: number;
	totalCacheReads?: number;
	totalCost: number;
	contextTokens: number; // Total tokens in conversation (last message's tokensIn + tokensOut)
}