import {BrowserWindow, app, ipcMain} from 'electron'
import * as path from 'path'
import {fileURLToPath} from "url";
import {dirname} from "path";
import {ClineProvider} from "@/core/webview/ClineProvider";
import * as vscode from "vscode";
import {MockExtensionContext, MockWebviewView} from "../vscode";
import { createMenu } from '@/menu';

// 创建后台服务进程
import { fork } from 'child_process'
import { join } from 'path'

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

function createHelloWorker() {
    const isDev = process.env.NODE_ENV === 'development'
    const workerPath = join(__dirname, 
        isDev ? '../dist-electron/services/hello.js' 
              : './services/hello.js'
    )
    
    const worker = fork(workerPath)
    
    worker.on('message', (message) => {
        console.log('Main received:', message)
    })
    
    // 发送测试消息
    worker.send({ type: 'HELLO', data: 'Hello from main process!' })
    
    return worker
}

const createWindow = async () => {
    const win = new BrowserWindow({
        width: 1600,
        height: 600,
        webPreferences:{
            preload: path.join(__dirname, 'preload.js'), // 注入 preload 脚本
            contextIsolation: true,                      // 启用上下文隔离
        }
    })

    // 创建并应用菜单
    createMenu(win);

    let webview: MockWebviewView = new MockWebviewView('mock',win);

    ipcMain.on('message', async (event, data) => {

        if (data === 'webview ready'){
            console.log('[waht]', 'webview ready')
            const outputChannel = vscode.window.createOutputChannel("Roo-Code")
            const context  = new MockExtensionContext();
            const cp = new ClineProvider(context, outputChannel)
            cp.resolveWebviewView(webview)
            await cp.clearTask()
            await cp.postStateToWebview()
            await cp.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
        } else {
            console.log('[waht] try fire data: ',data, `webview ${webview}`)
            if (webview){
                if (data.type === 'upsertApiConfiguration'){
                    const apiConfiguration = data.apiConfiguration
                    for (let key in apiConfiguration){
                        if (!apiConfiguration[key]){
                            apiConfiguration[key] = ''
                        }
                    }
                }
                console.log(`[waht] fire data ${data}`,)
                webview.webview.eventEmitter.fire(data)
            }
        }
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
}

app.whenReady().then(() => {
    createHelloWorker()
    createWindow()
})

//输出当前路径
// console.log(path.resolve('.'))

// console.log('[waht]',__filename,__dirname)
