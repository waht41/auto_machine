import { taskHandlers } from './taskHandler';
import { promptHandlers } from './promptHandler';
import { stateHandlers } from './stateHandler';
import { apiHandlers } from './apiHandler';
import { mcpHandlers } from './mcpHandler';
import { permissionHandlers } from './permissionHandler';
import { fileHandlers } from './fileHandler';
import { soundHandlers } from './soundHandler';
import { launchHandlers } from './launchHandler';
import { diffHandlers } from './diffHandler';
import { chatHandlers } from './chatHandler';
import { assistantHandlers } from './assistantHandler';
import { type ClineProvider } from '@core/webview/ClineProvider';
import { WebviewMessage } from '@/shared/WebviewMessage';
import { clineHandler } from '@core/webview/handlers/clineHandler';

type Handler<T extends WebviewMessage> = (instance: ClineProvider, message: T) => Promise<void> | void;
export const handlers: {
	[K in WebviewMessage['type']]: Handler<Extract<WebviewMessage, { type: K }>>
} = {
	...taskHandlers,
	...promptHandlers,
	...stateHandlers,
	...apiHandlers,
	...mcpHandlers,
	...permissionHandlers,
	...fileHandlers,
	...soundHandlers,
	...launchHandlers,
	...diffHandlers,
	...chatHandlers,
	...assistantHandlers,
	...clineHandler
};
