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