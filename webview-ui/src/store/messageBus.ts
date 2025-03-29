import mitt, { Emitter, Handler } from 'mitt';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { APP_MESSAGE, BACKGROUND_MESSAGE } from '@webview-ui/store/const';
import { BackgroundMessage } from '@webview-ui/store/type';

// 定义消息事件类型
export type MessageEvents = {
  // 扩展消息事件，用于处理从扩展传来的消息
  [BACKGROUND_MESSAGE]: BackgroundMessage;
  // 应用消息事件，用于处理应用内部的消息
  [APP_MESSAGE]: unknown;
};

/**
 * 消息总线类
 * 用于处理应用内部和扩展之间的消息通信
 */
class MessageBus {
	private emitter: Emitter<MessageEvents>;
	private initialized = false;
	private cleanupFunction: (() => void);

	constructor() {
		this.emitter = mitt<MessageEvents>();

		// eslint-disable-next-line @typescript-eslint/no-empty-function
		this.cleanupFunction = () => {};
	}

	/**
   * 初始化消息总线，设置全局消息监听
   * @returns 清理函数
   */
	init(): () => void {
		if (this.initialized) {
			return this.cleanupFunction;
		}

		// 监听来自window的消息事件，并转发到消息总线
		const handleWindowMessage = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data;
			// 将window消息转发到消息总线
			this.emit(BACKGROUND_MESSAGE, message);
		};

		// 添加全局消息事件监听器
		window.addEventListener('message', handleWindowMessage);

		// 处理Electron环境下的消息
		let electronCleanup: (() => void) | null = null;
		if (window.electronApi) {
			const handleElectronMessage = (data: unknown) => {
				try {
					const targetOrigin = window.location.origin;
					window.postMessage(data, targetOrigin);
				} catch (error) {
					console.error('Failed to process message when transport message', error);
				}
			};

			window.electronApi.on('message', handleElectronMessage);
			window.electronApi.send('message', 'webview ready');

			electronCleanup = () => {
				console.log('Electron message listener cleanup');
			};
		}

		// 设置清理函数
		this.cleanupFunction = () => {
			window.removeEventListener('message', handleWindowMessage);
			if (electronCleanup) {
				electronCleanup();
			}
			this.initialized = false;
		};

		this.initialized = true;
		return this.cleanupFunction;
	}

	/**
   * 订阅消息事件
   * @param type 事件类型
   * @param handler 事件处理函数
   */
	on<Key extends keyof MessageEvents>(type: Key, handler: Handler<MessageEvents[Key]>): void {
		this.emitter.on(type, handler);
	}

	/**
   * 取消订阅消息事件
   * @param type 事件类型
   * @param handler 事件处理函数
   */
	off<Key extends keyof MessageEvents>(type: Key, handler: Handler<MessageEvents[Key]>): void {
		this.emitter.off(type, handler);
	}

	/**
   * 发送消息事件
   * @param type 事件类型
   * @param event 事件数据
   */
	emit<Key extends keyof MessageEvents>(type: Key, event: MessageEvents[Key]): void {
		this.emitter.emit(type, event);
	}

	/**
   * 向扩展发送消息
   * @param message 消息内容
   */
	sendToElectron(message: unknown): void {
		try {
			if (window.electronApi) {
				// 如果是Electron环境
				window.electronApi.send('message', message);
			} else {
				// 如果是VSCode Webview环境
				// @ts-ignore
				const vscode = acquireVsCodeApi();
				vscode.postMessage(message);
			}
		} catch (error) {
			console.error('Failed to send message to electron', error);
		}
	}
}

const messageBus = new MessageBus();
export default messageBus;