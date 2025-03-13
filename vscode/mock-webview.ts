import * as vscode from 'vscode';
import {EventEmitter} from 'events';
import {BrowserWindow, ipcMain} from 'electron';

// 模拟 vscode 模块


// 模拟 Webview 实现
class MockWebview implements vscode.Webview {
	private _options = {enableScripts: false, localResourceRoots: [] as string[]};
	private _html = '';
	listeners : any = [];
	eventEmitter : vscode.EventEmitter<any>;
	onDidReceiveMessage: vscode.Event<any>;

	constructor(private post: (message: any) => void) {
		this.eventEmitter = new vscode.EventEmitter();
		this.onDidReceiveMessage = this.eventEmitter.event;
	}


	get options() {
		return this._options;
	}

	set options(value: Partial<typeof this._options>) {
		this._options = {...this._options, ...value};
	}

	get html() {
		return this._html;
	}

	set html(value: string) {
		this._html = value;
	}

	postMessage(message: any): Thenable<boolean> {
		this.post(message);
		return Promise.resolve(true);
	}
}

// 模拟 WebviewView 实现
export class MockWebviewView extends EventEmitter implements vscode.WebviewView {
	readonly viewType: string;
	readonly webview: MockWebview;
	visible = false;

	private _disposed = false;

	constructor(viewType: string, post: (message: any) => void) {
		super();
		this.viewType = viewType;
		this.webview = new MockWebview(post);
		console.log(`[WebviewView] Created (type: ${viewType})`);
	}

	get onDidDispose() {
		return this.addListener.bind(this, 'dispose') as unknown as vscode.Event<void>;
	}

	get onDidChangeVisibility() {
		return this.addListener.bind(this, 'visibility-change') as unknown as vscode.Event<void>;
	}

	show(preserveFocus?: boolean): void {
		if (!this.visible) {
			this.visible = true;
			this.emit('visibility-change');
		}
	}

	dispose() {
		if (!this._disposed) {
			this._disposed = true;
			this.emit('dispose');
		}
	}
}
