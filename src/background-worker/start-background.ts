// 简单的后台服务进程
import { MockExtensionContext, MockWebviewView, window } from '../../vscode';
import { ClineProvider } from '@core/webview/ClineProvider';

let webview: MockWebviewView = new MockWebviewView('mock',
    (message) => {
        if (process.send) {
            process.send(message);
        } else {
            console.error('[background] process.send is undefined');
        }
    }
);
const outputChannel = window.createOutputChannel('Roo-Code');
const context = new MockExtensionContext();
//@ts-ignore
const cp = new ClineProvider(context, outputChannel);
//@ts-ignore
cp.resolveWebviewView(webview);

process.on('message', async (message: any) => {
    // console.log('Worker received:', message);


    if (message === 'webview ready') {

        await cp.clearTask();
        await cp.postStateToWebview();
        await cp.postMessageToWebview({type: 'action', action: 'chatButtonClicked'});
    } else {
        if (webview) {
            if (message.type === 'upsertApiConfiguration') {
                const apiConfiguration = message.apiConfiguration;
                for (let key in apiConfiguration) {
                    if (!apiConfiguration[key]) {
                        apiConfiguration[key] = '';
                    }
                }
            }
            // console.log(`[waht] fire data ${message}`);
            webview.webview.eventEmitter.fire(message);
        }
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('[background] Uncaught Exception:', error);
    // 发送错误信息到主进程
    if (process.send) {
        process.send({ type: 'worker-error', error: error.message });
    }
    // 给一个短暂的时间让错误消息发送出去
    setTimeout(() => {
        process.exit(1);
    }, 100);
});

// 处理 Promise 中的未捕获异常
process.on('unhandledRejection', (reason, promise) => {
    console.error('[background] Unhandled Rejection at:', promise, 'reason:', reason);
    // 发送错误信息到主进程
    if (process.send) {
        process.send({ type: 'worker-error', error: String(reason) });
    }
    // 给一个短暂的时间让错误消息发送出去
    setTimeout(() => {
        process.exit(1);
    }, 100);
});

// 保持进程运行
process.on('disconnect', () => {
    process.exit(0);
});

console.log('Hello worker process started again！！！!');
