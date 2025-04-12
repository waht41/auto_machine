import mitt, { Emitter, Handler } from 'mitt';
import { ExtensionMessage } from '@/shared/ExtensionMessage';

// 定义消息事件类型
export type MessageEvents = {
  // 扩展消息事件
  'webviewMessage': ExtensionMessage;
  // 后台消息事件
  'background': any;
};

/**
 * 消息服务类
 * 用于处理后台工作进程中的消息通信
 */
export class MessageService {
	private static instance: MessageService;
	private emitter: Emitter<MessageEvents>;
	private postMessage: Handler<ExtensionMessage>;

	private constructor() {
		this.emitter = mitt<MessageEvents>();
		this.postMessage = () => {
			console.warn('MessageService.postMessage not set');
		};
	}


	static getInstance() {
		if (!MessageService.instance) {
			MessageService.instance = new MessageService();
		}
		return MessageService.instance;
	}

	setPostMessage(postMessage: Handler<ExtensionMessage>) {
		this.postMessage = postMessage;
	}

	/**
	 * 订阅消息事件
	 * @param type 事件类型
	 * @param handler 事件处理函数
	 */
	subscribe<Key extends keyof MessageEvents>(type: Key, handler: Handler<MessageEvents[Key]>): void {
		this.emitter.on(type, handler);
	}

	/**
	 * 取消订阅消息事件
	 * @param type 事件类型
	 * @param handler 事件处理函数
	 */
	unsubscribe<Key extends keyof MessageEvents>(type: Key, handler: Handler<MessageEvents[Key]>): void {
		this.emitter.off(type, handler);
	}

	/**
	 * 发布消息事件
	 * @param type 事件类型
	 * @param event 事件数据
	 */
	publish<Key extends keyof MessageEvents>(type: Key, event: MessageEvents[Key]): void {
		this.emitter.emit(type, event);
	}

	/**
	 * 向 Webview 发送消息
	 * @param message 消息内容
	 */
	public async postMessageToWebview(message: ExtensionMessage) {
		this.postMessage(message);
	}
}