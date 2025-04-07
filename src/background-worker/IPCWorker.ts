import { ClientHandler } from '@/background-worker/ClientHandler';
import process from 'node:process';

/**
 * IPC Worker 类，负责处理后台进程与主进程的通信
 */
class IPCWorker {
	private clientHandler = new ClientHandler(this.sendToMainProcess.bind(this));

	constructor() {
		this.clientHandler.init().then(
			() => {
				this.setupEventListeners();
				console.log('Hello worker process started!!!');
			}
		).catch(this.handleUncaughtException.bind(this));
	}

	/**
   * 发送消息到主进程
   */
	public sendToMainProcess(message: any): void {
		if (process.send) {
			process.send(message);
		} else {
			console.error('[background] process.send is undefined');
		}
	}

	/**
   * 设置事件监听器
   */
	private setupEventListeners(): void {
		// 发送消息到主进程
		process.on('message', this.clientHandler.handleMessage.bind(this.clientHandler));  //需要时再考虑解耦吧
		// 处理未捕获的异常
		process.on('uncaughtException', this.handleUncaughtException.bind(this));

		// 处理 Promise 中的未捕获异常
		process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));

		// 处理断开连接事件
		process.on('disconnect', () => {
			process.exit(0);
		});
	}

	/**
   * 注册消息处理函数
   */
	public onMessage(callback: (message: any) => Promise<void>): void {
		process.on('message', callback);
	}

	/**
   * 处理未捕获的异常
   */
	private handleUncaughtException(error: Error): void {
		console.error('[background] Uncaught Exception:', error);
		// 发送错误信息到主进程
		if (process.send) {
			process.send({type: 'worker-error', error: error.message});
		}
		// 给一个短暂的时间让错误消息发送出去
		setTimeout(() => {
			process.exit(1);
		}, 100);
	}

	/**
   * 处理 Promise 中的未捕获异常
   */
	private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
		console.error('[background] Unhandled Rejection at:', promise, 'reason:', reason);
		// 发送错误信息到主进程
		if (process.send) {
			process.send({type: 'worker-error', error: String(reason)});
		}
	}
}

export { IPCWorker };
