import { BrowserWindow, ipcMain } from 'electron';
import { ChildProcess } from 'child_process';
import { ElectronService } from './electron-service';

/**
 * IPC 处理器 - 负责处理主进程、渲染进程和 worker 进程之间的通信
 */
export class IpcHandler {
	private electronService: ElectronService;

	constructor(private win: BrowserWindow, private worker?: ChildProcess) {
		this.electronService = new ElectronService(win);
		this.setupEventListeners();
	}

	/**
   * 设置所有事件监听器
   */
	private setupEventListeners(): void {
		this.setupRendererToWorkerChannel();
		this.setupWorkerToRendererChannel();
		this.setupWindowCloseHandler();
		this.setupDirectElectronChannel();
	}

	/**
   * 设置从渲染进程到 worker 的通信通道
   */
	private setupRendererToWorkerChannel(): void {
		// 清理旧的监听器
		ipcMain.removeAllListeners('message');
    
		// 接收来自渲染进程的消息，并转发给 worker
		ipcMain.on('message', async (event, data) => {
			try {
				if (this.worker && !this.worker.killed && event.sender && !event.sender.isDestroyed()) {
					this.worker.send(data);
				}
			} catch (error) {
				if (error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
					console.error('Error sending message to worker:', error);
				}
			}
		});
	}

	/**
   * 设置从 worker 到渲染进程的通信通道
   */
	private setupWorkerToRendererChannel(): void {
		if (!this.worker) return;

		this.worker.on('message', async (message) => {
			try {
				// 处理 electron 类型的消息
				if (message && message.type === 'electron') {
					const result = await this.electronService.handleMessage(message.payload);
          
					// 如果需要回传结果给 worker
					if (message.requestId) {
						this.worker?.send({
							type: 'electron-response',
							requestId: message.requestId,
							result
						});
					}
					return;
				}

				// 其他消息直接转发给渲染进程
				if (this.win && !this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
					this.win.webContents.send('message', message);
				}
			} catch (error) {
				if (error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
					console.error('Error handling worker message:', error);
				}
			}
		});
	}

	/**
   * 设置直接从渲染进程到 Electron 的通信通道
   * 这允许渲染进程直接调用 Electron 功能，而不需要通过 worker
   */
	private setupDirectElectronChannel(): void {
		ipcMain.removeAllListeners('electron');
    
		ipcMain.handle('electron', async (event, data) => {
			try {
				if (!data || typeof data !== 'object') {
					return { success: false, error: 'Invalid request format' };
				}
        
				return await this.electronService.handleMessage(data);
			} catch (error) {
				console.error('Error handling direct electron request:', error);
				return { 
					success: false, 
					error: error.message || 'Unknown error occurred' 
				};
			}
		});
	}

	/**
   * 设置窗口关闭处理器
   */
	private setupWindowCloseHandler(): void {
		this.win.on('closed', () => {
			if (this.worker && !this.worker.killed) {
				this.worker.removeAllListeners('message');
				this.worker.kill();
			}
      
			// 清理 IPC 监听器
			ipcMain.removeAllListeners('message');
			ipcMain.removeAllListeners('electron');
		});
	}

	/**
   * 更新 worker 引用
   */
	public updateWorker(worker: ChildProcess): void {
		this.worker = worker;
		this.setupWorkerToRendererChannel();
	}

	/**
   * 直接向渲染进程发送消息
   */
	public sendToRenderer(message: any): void {
		if (this.win && !this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
			this.win.webContents.send('message', message);
		}
	}

	/**
   * 直接向 worker 发送消息
   */
	public sendToWorker(message: any): void {
		if (this.worker && !this.worker.killed) {
			this.worker.send(message);
		}
	}
}
