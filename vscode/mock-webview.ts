import {EventEmitter} from 'events';
import vscode from "vscode";

// 模拟 vscode 模块


// 模拟 Webview 实现
class MockWebview extends EventEmitter implements vscode.Webview {
    private _options = {enableScripts: false, localResourceRoots: [] as string[]};
    private _html = '';

    get options() {
        console.log('[Webview] Get options:', this._options);
        return this._options;
    }

    set options(value: Partial<typeof this._options>) {
        console.log('[Webview] Set options:', value);
        this._options = {...this._options, ...value};
    }

    get html() {
        console.log('[Webview] Get HTML');
        return this._html;
    }

    set html(value: string) {
        console.log('[Webview] Set HTML:', value.slice(0, 50) + '...');
        this._html = value;
    }

    postMessage(message: any): Thenable<boolean> {
        console.log('[Webview] Post message:', message);
        return Promise.resolve(true);
    }

    get onDidReceiveMessage() {
        return this.addListener.bind(this, 'message') as unknown as vscode.Event<any>;
    }
}

// 模拟 WebviewView 实现
export class MockWebviewView extends EventEmitter implements vscode.WebviewView {
    readonly viewType: string;
    readonly webview = new MockWebview();
    visible = false;

    private _disposed = false;

    constructor(viewType: string) {
        super();
        this.viewType = viewType;
        console.log(`[WebviewView] Created (type: ${viewType})`);
    }

    get onDidDispose() {
        return this.addListener.bind(this, 'dispose') as unknown as vscode.Event<void>;
    }

    get onDidChangeVisibility() {
        return this.addListener.bind(this, 'visibility-change') as unknown as vscode.Event<void>;
    }

    show(preserveFocus?: boolean): void {
        console.log(`[WebviewView] Show (preserveFocus: ${preserveFocus})`);
        if (!this.visible) {
            this.visible = true;
            this.emit('visibility-change');
        }
    }

    dispose() {
        if (!this._disposed) {
            console.log('[WebviewView] Dispose');
            this._disposed = true;
            this.emit('dispose');
        }
    }
}

// 模拟扩展上下文
export class MockExtensionContext {
    private _state: Record<string, any> = {};

    constructor(public extensionUri: string) {
    }

    async getState() {
        console.log('[ExtensionContext] Get state:', this._state);
        return {...this._state};
    }

    async setState(state: Record<string, any>) {
        console.log('[ExtensionContext] Set state:', state);
        this._state = {...this._state, ...state};
    }
}