import { ClineProvider } from '@core/webview/ClineProvider';
import { MockExtensionContext, MockWebviewView, window } from '../../vscode';

/**
 * 客户端处理器，负责处理与客户端相关的业务逻辑
 */
export class ClientHandler {
    private cp: ClineProvider;
    private webview: MockWebviewView;
    private outputChannel: any;
    private context: MockExtensionContext;

    constructor(sendToMainProcess: (message: any) => void) {
        this.webview = new MockWebviewView('mock', sendToMainProcess);
        this.outputChannel = window.createOutputChannel('Roo-Code');
        this.context = new MockExtensionContext();
        //@ts-ignore
        this.cp = new ClineProvider(this.context, this.outputChannel, sendToMainProcess);
        //@ts-ignore
        this.cp.resolveWebviewView(this.webview);
    }

    /**
     * 处理来自主进程的消息
     */
    public async handleMessage(message: any): Promise<void> {
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
}
