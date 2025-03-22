import { ClineApiReqInfo, ClineMessage } from '@/shared/ExtensionMessage';
import { Anthropic } from '@anthropic-ai/sdk';

export interface IUIMessage {
	apiReqInfo?: ClineApiReqInfo;
	clineMessages: ClineMessage[];
}

export type IApiConversationItem = Anthropic.MessageParam & { ts?: number };
export type IApiConversationHistory = IApiConversationItem[]