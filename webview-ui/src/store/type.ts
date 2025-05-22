import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { AGENT_STREAM_JUMP } from '@webview-ui/store/const';
import { AssistantStructure } from '@core/storage/type';

export type BackgroundMessage = ExtensionMessage;

export type BackGroundMessageHandler = (data: BackgroundMessage) => void;

export type AgentStreamJumpState = {
	type: typeof AGENT_STREAM_JUMP;
	id?: number;
};

export type AppMessage = AgentStreamJumpState;

export type AppMessageHandler = (data: AppMessage) => void;

export type SharedContext = {
	assistants?: AssistantStructure[]
}