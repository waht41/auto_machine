import {BrowserWindow, app, ipcMain} from 'electron'
import * as path from 'path'
import {fileURLToPath} from "url";
import {dirname} from "path";
import {ClineProvider} from "@/core/webview/ClineProvider";
import * as vscode from "vscode";
import {MockExtensionContext, MockWebviewView} from "vscode";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
global.require = require;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const createWindow = async () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences:{
            preload: path.join(__dirname, 'preload.js'), // 注入 preload 脚本
            contextIsolation: true,                      // 启用上下文隔离
        }
    })

    // const outputChannel = vscode.window.createOutputChannel("Roo-Code")
    // const context : vscode.MockExtensionContext  = new MockExtensionContext();
    // const webview = new MockWebviewView('mock',win)
    // const cp = new ClineProvider(context, outputChannel)

    // cp.resolveWebviewView(webview)
    // cp.initClineWithTask('hello')


    ipcMain.on('event-name', (event, data) => {
        // const text = data.toString('utf-8');
        console.log('[waht] receive from main: ',data)
    });


    if (process.env.NODE_ENV === 'development') {
        console.log('[waht] Loading development URL...');
        await win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    } else {
        await win.loadFile(
            path.join(__dirname, '../renderer/index.html'),
            {
                // 关键配置：设置根路径基准
                search: `?basePath=${path.dirname(__dirname)}`
            }
        )
    }
    let count = 0;
    setInterval(()=>{
        win.webContents.send('message', `a late message from server count ${count++}`);
        console.log('[waht]','time out')
    },2000)
}

app.whenReady().then(() => {
    createWindow()
})

//输出当前路径
// console.log(path.resolve('.'))

// console.log('[waht]',__filename,__dirname)