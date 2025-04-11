import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { AGENT_STREAM_JUMP } from '@webview-ui/store/const';

export type BackgroundMessage = ExtensionMessage;

export type BackGroundMessageHandler = (data: BackgroundMessage) => void;

export type AgentStreamJumpState = {
	type: typeof AGENT_STREAM_JUMP;
	timestamp: number;
};

export type AppMessage = AgentStreamJumpState;

export type AppMessageHandler = (data: AppMessage) => void;