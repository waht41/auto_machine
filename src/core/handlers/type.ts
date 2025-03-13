import { ClineApiReqInfo } from '@/shared/ExtensionMessage';

export interface ProcessingState {
	reasoningMessage: string;
	assistantMessage: string;
	apiReq: ClineApiReqInfo;
}
