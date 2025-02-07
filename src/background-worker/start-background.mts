// 简单的后台服务进程
import * as vscode from '../../vscode';
import { MockExtensionContext, MockWebviewView } from '../../vscode';
import { ClineProvider } from '@core/webview/ClineProvider';
import * as process from 'node:process';

process.on('message', async (message: any) => {
  console.log('Worker received:', message);

  // 回复消息给主进程
  process.send?.({
    type: 'HELLO_RESPONSE',
    data: 'Hello from worker process!'
  });
  let webview: MockWebviewView = new MockWebviewView('mock',
    (message) => {
      if (process.send) {
        process.send(message);
      } else {
        console.error('[background] process.send is undefined');
      }
    }
  );
  if (message === 'webview ready') {
    const outputChannel = vscode.window.createOutputChannel('Roo-Code');
    const context = new MockExtensionContext();
    //@ts-ignore
    const cp = new ClineProvider(context, outputChannel);
    //@ts-ignore
    cp.resolveWebviewView(webview);
    await cp.clearTask();
    await cp.postStateToWebview();
    await cp.postMessageToWebview({ type: 'action', action: 'chatButtonClicked' });
  } else {
    console.log('[waht] try fire data: ', message, `webview ${webview}`);
    if (webview) {
      if (message.type === 'upsertApiConfiguration') {
        const apiConfiguration = message.apiConfiguration;
        for (let key in apiConfiguration) {
          if (!apiConfiguration[key]) {
            apiConfiguration[key] = '';
          }
        }
      }
      console.log(`[waht] fire data ${message}`);
      webview.webview.eventEmitter.fire(message);
    }
  }
});

// 保持进程运行
process.on('disconnect', () => {
  process.exit(0);
});

console.log('Hello worker process started！！！!');
