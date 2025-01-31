// electron-webview-adapter.ts
import { BrowserWindow, ipcMain, IpcMainEvent, WebContents } from 'electron';
import { EventEmitter } from 'events';

// 模拟 vscode.Webview 接口
class ElectronWebview {
    private webContents: WebContents;
    private messageListeners: Array<(message: any) => void> = [];
    private _options: { enableScripts: boolean; localResourceRoots: string[] } = {
        enableScripts: false,
        localResourceRoots: []
    };

    constructor(webContents: WebContents) {
        this.webContents = webContents;

        // 处理来自渲染进程的消息
        ipcMain.on('webview-message', (event, message) => {
            if (event.sender === this.webContents) {
                this.messageListeners.forEach(listener => listener(message));
            }
        });
    }

    get options() {
        return this._options;
    }

    set options(value: Partial<typeof this._options>) {
        this._options = { ...this._options, ...value };
    }

    html = '';

    postMessage(message: any): Thenable<boolean> {
        return new Promise(resolve => {
            this.webContents.send('webview-post-message', message);
            resolve(true);
        });
    }

    onDidReceiveMessage(listener: (message: any) => void) {
        this.messageListeners.push(listener);
        return {
            dispose: () => {
                this.messageListeners = this.messageListeners.filter(l => l !== listener);
            }
        };
    }
}

// 模拟 vscode.WebviewView 接口
class ElectronWebviewView extends EventEmitter {
    viewType: string;
    webview: ElectronWebview;
    title?: string;
    description?: string;
    visible = true;

    private window: BrowserWindow;

    constructor(viewType: string, window: BrowserWindow) {
        super();
        this.viewType = viewType;
        this.window = window;
        this.webview = new ElectronWebview(window.webContents);

        // 窗口可见性处理
        window.on('show', () => {
            this.visible = true;
            this.emit('visibility-change');
            this.emit('did-become-visible');
        });

        window.on('hide', () => {
            this.visible = false;
            this.emit('visibility-change');
        });

        window.on('closed', () => {
            this.emit('dispose');
        });
    }

    show(preserveFocus?: boolean): void {
        if (preserveFocus) {
            this.window.showInactive();
        } else {
            this.window.show();
        }
    }

    // 其他需要实现的方法...
}

// 主进程初始化代码
export function initializeWebviewSystem(mainWindow: BrowserWindow) {
    // 处理来自渲染进程的 webview 消息
    ipcMain.on('webview-post-message', (event, message) => {
        // 这里可以添加自定义消息处理逻辑
        console.log('Received message from webview:', message);
    });

    return {
        createWebviewView: (viewType: string): ElectronWebviewView => {
            return new ElectronWebviewView(viewType, mainWindow);
        }
    };
}
