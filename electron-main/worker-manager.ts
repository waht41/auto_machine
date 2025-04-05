import { app, BrowserWindow } from 'electron';
import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { join } from 'path';
import chokidar from 'chokidar';
import { Stats } from 'fs';
import { IpcHandler } from './ipc-handler';

export const getAssetsPath = (): string => {
	// 生产环境下使用 process.resourcesPath 获取资源目录
	if (app.isPackaged) {
		return join(process.resourcesPath, 'assets');
	} else {
		// 开发环境下基于项目根目录定位资源
		return join(app.getAppPath(), 'resources', 'assets');
	}
};

export const getUserDataPath = (): string => {
	return app.getPath('userData');
};

export class WorkerManager {
	private worker: ChildProcess | null = null;
	private restartAttempts = 0;
	private readonly maxRestartAttempts = 5;
	private readonly restartDelay = 1000; // 1秒延迟重启
	private readonly isDev = process.env.NODE_ENV === 'development';
	private ipcHandler: IpcHandler | null = null;

	constructor(private win?: BrowserWindow) {}

	/**
     * 设置 IPC 处理器
     * @param handler IPC 处理器实例
     */
	public setIpcHandler(handler: IpcHandler): void {
		this.ipcHandler = handler;
	}

	send = (message: any) => {
		if (this.worker && !this.worker.killed) {
			this.worker.send(message);
		}
	};

	public init() {
		this.worker = this.startWorker();

		if (this.isDev) {
			this.setupDevWatcher();
		}

		return this.worker;
	}

	private startWorker() {
		const workerPath =this.isDev ? join(__dirname,
			'../../src/background-worker/start-background.ts') : join(app.getAppPath(), 'build', 'background','start-background.js');
		const workerEnv: any = {
			...process.env,
			NODE_ENV: this.isDev ? 'development' : 'production',
		};
		if (!this.isDev){
			workerEnv.ASSETS_PATH = getAssetsPath();
			workerEnv.USER_DATA_PATH = getUserDataPath();
		}

		this.worker = fork(workerPath, [], {
			execArgv: this.isDev ? ['--import', 'tsx'] : [],
			env: workerEnv,
		});

		this.worker.on('message', (message: any) => {
			if (message.type === 'worker-error') {
				console.error('[main] Worker error:', message.error);
			}
			if (this.win && !this.win.isDestroyed()) {
				this.win.webContents.send('background-message', message);
			}
		});

		this.worker.on('exit', (code) => {
			console.log(`[main] Worker process exited with code ${code}`);
			if (code !== 0) {
				if (this.restartAttempts < this.maxRestartAttempts) {
					this.restartAttempts++;
					console.log(`[main] Attempting to restart worker (${this.restartAttempts}/${this.maxRestartAttempts})...`);
					setTimeout(() => {
						if (this.win && !this.win.isDestroyed()) {
							this.startWorker();
							// 更新 IpcHandler 中的 worker 引用
							if (this.ipcHandler && this.worker) {
								this.ipcHandler.updateWorker(this.worker);
							}
						}
					}, this.restartDelay);
				} else {
					console.error('[main] Max restart attempts reached. Please check the worker process.');
				}
			}
		});

		// 成功启动后重置重启计数
		this.worker.on('spawn', () => {
			this.restartAttempts = 0;
			console.log('[main] Worker process started successfully');
		});

		return this.worker;
	}

	private setupDevWatcher() {
		const ignored = (file: string, _s: Stats | undefined) => {
			if (!_s?.isFile()){
				return false;
			}
			const watchedTypes = ['.js', '.ts'];
			return !watchedTypes.some((type) => file.endsWith(type));
		};
		const watcher = chokidar.watch([
			path.join(__dirname,'../../vscode'),
			path.join(__dirname,'../../src'),
			path.join(__dirname,'../../operation'),
			path.join(__dirname,'../../executors'),
		], {
			ignored: ignored,
			persistent: true,
			interval: 1000,
		});

		watcher.on('change', (filePath) => {
			console.log(`File ${filePath} has been changed. Restarting worker...`);
			if (this.worker) {
				this.worker.removeAllListeners('message');  // 清理旧的消息监听器
				this.worker.kill();
			}
		});

		watcher.on('error', (error) => {
			console.error('Chokidar error:', error);
		});
	}

	public getWorker() {
		return this.worker;
	}
}
