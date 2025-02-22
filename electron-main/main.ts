import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { createMenu } from './menu';
import { WorkerManager } from './worker-manager';

const isDev = process.env.NODE_ENV === 'development';
const createWindow = async () => {
    const win = new BrowserWindow({
        width: 1600,
        height: 600,
        webPreferences: {
            preload: isDev ? path.join(__dirname, 'preload.js'): path.join(app.getAppPath(), 'build','electron', 'preload.js'),
            contextIsolation: true,
        }
    })

    // 初始化 worker 管理器
    const workerManager = new WorkerManager(win);
    workerManager.init();

    // 创建并应用菜单
    createMenu(win, workerManager.send);

    if (process.env.NODE_ENV === 'development') {
        await win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    } else {
        await win.loadFile(
            path.join(app.getAppPath(),'build','index.html'),
        )
    }
}

app.whenReady().then(() => {
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
