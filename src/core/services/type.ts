import { ClineApiReqInfo, ClineMessage } from '@/shared/ExtensionMessage';
import { Anthropic } from '@anthropic-ai/sdk';
import { ClineStatus } from '@/shared/type';

export interface IUIMessage {
	apiReqInfo?: ClineApiReqInfo;
	clineMessages: ClineMessage[];
	task: string;
	parentId?: string;
	plan?: IPlan
}

export interface IPlan {
	steps: string[];
	currentStep: number;
}

export type IApiConversationItem = Anthropic.MessageParam & { ts?: number };
export type IApiConversationHistory = IApiConversationItem[];

export type Memory = {
	title: string;
	keywords: string[];
	content: string;
	category: string;
	createTime?: string;
}
export type SearchOption = {
	category?: string;
	keywords?: string[];
}
export type InterClineMessage = {
	sourceId: string;
	targetId: string;
	sourceStatus: ClineStatus;
	message: string;
}