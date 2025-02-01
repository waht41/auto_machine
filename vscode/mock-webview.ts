import {EventEmitter} from 'events';
import vscode, {Disposable} from "vscode";

// 模拟 vscode 模块


// 模拟 Webview 实现
class MockWebview extends EventEmitter implements vscode.Webview {
    private _options = {enableScripts: false, localResourceRoots: [] as string[]};
    private _html = '';
    listeners : any = []

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
        for(const listener of this.listeners) {
            listener(message)
        }
        return Promise.resolve(true);
    }

    onDidReceiveMessage(listener: (e) => any, thisArgs?: any, disposables?: Disposable[]) {
        console.log('[WebviewView] Received message:', thisArgs);
        this.listeners.push(listener)  // todo waht 需要先修复这个
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