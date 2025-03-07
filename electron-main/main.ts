import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { createMenu } from './menu';
import { WorkerManager } from './worker-manager';
import { ElectronService } from './electron-service';
import { IpcHandler } from './ipc-handler';

// 全局变量，用于存储应用程序状态
let mainWindow: BrowserWindow | null = null;
let workerManager: WorkerManager | null = null;
let electronService: ElectronService | null = null;
let ipcHandler: IpcHandler | null = null;

const isDev = process.env.NODE_ENV === 'development';

/**
 * 创建主窗口
 */
const createWindow = async () => {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 600,
        webPreferences: {
            preload: isDev ? path.join(__dirname, 'preload.js'): path.join(app.getAppPath(), 'build','electron', 'preload.js'),
            contextIsolation: true,
        }
    });

    // 初始化 Electron 服务
    electronService = new ElectronService(mainWindow);

    // 初始化 worker 管理器
    workerManager = new WorkerManager(mainWindow);
    const worker = workerManager.init();

    // 创建 IPC 处理器，用于处理进程间通信
    ipcHandler = new IpcHandler(mainWindow, worker);
    
    // 设置 WorkerManager 的 IpcHandler
    workerManager.setIpcHandler(ipcHandler);

    // 创建并应用菜单
    createMenu(mainWindow, workerManager.send);

    // 加载应用
    if (isDev) {
        await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
    } else {
        await mainWindow.loadFile(
            path.join(app.getAppPath(),'build','index.html'),
        )
    }

    // 窗口关闭时清理资源
    mainWindow.on('closed', () => {
        mainWindow = null;
        workerManager = null;
        electronService = null;
        ipcHandler = null;
    });
}

// 应用程序准备就绪时创建窗口
app.whenReady().then(() => {
    createWindow();

    // 设置应用程序激活时的行为
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('Main process uncaught exception:', error);
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('Main process unhandled rejection:', reason);
});
