import { BrowserWindow, ipcMain } from 'electron';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import * as path from 'path';
import chokidar from 'chokidar';

export class WorkerManager {
    private worker: ChildProcess | null = null;
    private restartAttempts = 0;
    private readonly maxRestartAttempts = 5;
    private readonly restartDelay = 1000; // 1秒延迟重启
    private readonly isDev = process.env.NODE_ENV === 'development';

    constructor(private win?: BrowserWindow) {}

    private setupWorkerMessageHandlers(worker: ChildProcess) {
        if (this.win) {
            // 接收来自渲染进程的消息，并转发给 worker
            ipcMain.removeAllListeners('message');  // 清理旧的监听器
            ipcMain.on('message', async (event, data) => {
                try {
                    if (worker && !worker.killed && event.sender && !event.sender.isDestroyed()) {
                        worker.send(data);
                    }
                } catch (error) {
                    if (error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
                        console.error('Error sending message to worker:', error);
                    }
                }
            });

            // 接收来自 worker 的消息，并转发给渲染进程
            worker.on('message', (message) => {
                try {
                    if (this.win && !this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
                        this.win.webContents.send('message', message);
                    }
                } catch (error) {
                    if (error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
                        console.error('Error sending message to renderer:', error);
                    }
                }
            });

            // 监听窗口关闭事件
            this.win.on('closed', () => {
                if (this.worker && !this.worker.killed) {
                    this.worker.removeAllListeners('message');
                    this.worker.kill();
                }
            });
        }
    }

    private startWorker() {
        const workerPath = join(__dirname,
            this.isDev ? '../src/background-worker/start-background.ts'
                : '../background/start-background.js'
        );

        this.worker = fork(workerPath, [], {
            execArgv: this.isDev ? ['--import', 'tsx'] : []
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

        this.setupWorkerMessageHandlers(this.worker);

        return this.worker;
    }

    public init() {
        this.worker = this.startWorker();

        if (this.isDev) {
            this.setupDevWatcher();
        }

        return this.worker;
    }

    private setupDevWatcher() {
        const projectRoot = path.resolve(__dirname, '../..');
        console.log('[waht] watching: ', path.join(projectRoot, 'src/**/*.{js,ts}'));
        
        const watcher = chokidar.watch([
            path.join(projectRoot, 'src/**/*.{js,ts}'),
            path.join(projectRoot, 'vscode/**/*.{js,ts}')
        ], {
            ignored: /(^|[\/\\])\../,
            persistent: true
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

        watcher.on('ready', () => {
            console.log('Chokidar is ready.');
        });
    }

    public getWorker() {
        return this.worker;
    }
}
