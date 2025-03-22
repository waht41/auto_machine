import { Anthropic } from '@anthropic-ai/sdk';

export type IApiConversationItem = Anthropic.MessageParam & { ts?: number };
export type IApiConversationHistory = IApiConversationItem[]

