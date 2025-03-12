import { ipcMain } from 'electron';
import * as vscode from '../../vscode';
import { MockExtensionContext } from '../../vscode';
import { ClineProvider } from '@core/webview/ClineProvider';
import { MockWebviewView } from '../../vscode';

export class ClineService {
	private cp: ClineProvider | null = null;
	private outputChannel: any;
	private context: MockExtensionContext;

	constructor(private webview:MockWebviewView) {
		this.outputChannel = vscode.window.createOutputChannel('Roo-Code');
		this.context = new MockExtensionContext();
		this.initializeIPC();
	}

	private initializeIPC() {
		ipcMain.on('vscode-service', async (_event, message) => {
			try {
				switch (message.type) {
					case 'init':
						if (!this.webview) {
							console.error('[VSCodeService] Webview not initialized');
							return;
						}
						await this.initializeProvider();
						break;
					case 'message':
						if (!this.webview) {
							console.error('[VSCodeService] Webview not initialized');
							return;
						}
						await this.handleMessage(message.data);
						break;
					default:
						console.log('[VSCodeService] Unknown message type:', message.type);
				}
			} catch (error) {
				console.error('[VSCodeService] Error handling message:', error);
			}
		});
	}

	private async initializeProvider() {
		if (!this.webview || !this.cp) {
			this.cp = new ClineProvider(this.context, this.outputChannel);
			this.cp.resolveWebviewView(this.webview);
			await this.cp.clearTask();
			await this.cp.postStateToWebview();
			await this.cp.postMessageToWebview({ type: 'action', action: 'chatButtonClicked' });
		}
	}

	private async handleMessage(data: any) {
		if (this.webview) {
			this.webview.webview.eventEmitter.fire(data);
		}
	}
}