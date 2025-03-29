import { ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';

export type ClineMessageState = {
	type: 'state';
	state: {
		clineMessages: ClineMessage[];
	};
} | {
	type: 'partialMessage';
	partialMessage: ClineMessage;
}

export type BackgroundMessage = ExtensionMessage | ClineMessageState;

export type MessageHandler = (data: BackgroundMessage) => void;