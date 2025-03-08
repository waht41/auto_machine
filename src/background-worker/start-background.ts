import { MockExtensionContext, MockWebviewView, window } from '../../vscode';
import { ClineProvider } from '@core/webview/ClineProvider';

/**
 * IPC Worker 类，负责处理后台进程与主进程的通信
 */
class IPCWorker {
    private webview: MockWebviewView;
    private outputChannel: any;
    private context: MockExtensionContext;
    private cp: ClineProvider;

    constructor() {
        this.webview = new MockWebviewView('mock', this.sendToMainProcess.bind(this));
        this.outputChannel = window.createOutputChannel('Roo-Code');
        this.context = new MockExtensionContext();
        //@ts-ignore
        this.cp = new ClineProvider(this.context, this.outputChannel);
        //@ts-ignore
        this.cp.resolveWebviewView(this.webview);

        this.setupEventListeners();
        console.log('Hello worker process started again！！！!');
    }

    /**
     * 发送消息到主进程
     */
    private sendToMainProcess(message: any): void {
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
        // 处理来自主进程的消息
        process.on('message', this.handleMessage.bind(this));

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
     * 处理来自主进程的消息
     */
    private async handleMessage(message: any): Promise<void> {
        if (message === 'webview ready') {
            await this.cp.clearTask();
            await this.cp.postStateToWebview();
            await this.cp.postMessageToWebview({type: 'action', action: 'chatButtonClicked'});
        } else {
            if (this.webview) {
                if (message.type === 'upsertApiConfiguration') {
                    const apiConfiguration = message.apiConfiguration;
                    for (let key in apiConfiguration) {
                        if (!apiConfiguration[key]) {
                            apiConfiguration[key] = '';
                        }
                    }
                }
                this.webview.webview.eventEmitter.fire(message);
            }
        }
    }

    /**
     * 处理未捕获的异常
     */
    private handleUncaughtException(error: Error): void {
        console.error('[background] Uncaught Exception:', error);
        // 发送错误信息到主进程
        if (process.send) {
            process.send({ type: 'worker-error', error: error.message });
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
            process.send({ type: 'worker-error', error: String(reason) });
        }
        // 给一个短暂的时间让错误消息发送出去
        setTimeout(() => {
            process.exit(1);
        }, 100);
    }
}

// 创建并启动 IPCWorker 实例
const worker = new IPCWorker();
