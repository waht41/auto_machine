import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { createMenu } from './menu';
import { WorkerManager } from './worker-manager';
import { ElectronService } from './electron-service';
import { IpcHandler } from './ipc-handler';
import { WindowStateManager } from './window-state';
import { getIcon } from './utils';

// 设置应用程序名称
app.name = 'Auto Machine';

// 全局变量，用于存储应用程序状态
let mainWindow: BrowserWindow | null = null;
let workerManager: WorkerManager | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let electronService: ElectronService | null = null;
let ipcHandler: IpcHandler | null = null;
let windowStateManager: WindowStateManager | null = null;

const isDev = process.env.NODE_ENV === 'development';

/**
 * 创建主窗口
 */
const createWindow = async () => {
	// 初始化窗口状态管理器
	windowStateManager = new WindowStateManager();
	const windowState = windowStateManager.getState();
	
	// 获取窗口位置
	const position = windowStateManager.getWindowPosition();
	
	// 使用保存的窗口大小和位置，如果没有则使用默认值
	const windowOptions: Electron.BrowserWindowConstructorOptions = {
		width: windowState.bounds?.width || 2400,
		height: windowState.bounds?.height || 1000,
		x: position.x,
		y: position.y,
		webPreferences: {
			preload: isDev ? path.join(__dirname, 'preload.js'): path.join(app.getAppPath(), 'build','electron', 'preload.js'),
			contextIsolation: true,
		},
		icon: getIcon(),
		title: 'Auto Machine',
		show: false // 先不显示，避免闪烁
	};
	
	mainWindow = new BrowserWindow(windowOptions);

	mainWindow.once('ready-to-show', () => {
		if (windowState.isMaximized) {
			mainWindow?.maximize();
		}
		mainWindow?.show();
	});

	// 监听窗口大小和位置变化，保存状态
	mainWindow.on('close', () => {
		if (mainWindow && windowStateManager) {
			const isMaximized = mainWindow.isMaximized();
			const bounds = isMaximized ? undefined : mainWindow.getBounds();
			
			// 获取当前窗口所在的显示器
			let displayId;
			if (!isMaximized && bounds) {
				const display = screen.getDisplayMatching(bounds);
				displayId = display.id.toString();
			}
			
			windowStateManager.saveState(isMaximized, bounds, displayId);
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
		await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
	} else {
		await mainWindow.loadFile(
			path.join(app.getAppPath(),'build','index.html'),
		);
	}

	// 窗口关闭时清理资源
	mainWindow.on('closed', () => {
		mainWindow = null;
		workerManager = null;
		electronService = null;
		ipcHandler = null;
		windowStateManager = null;
	});
};

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
process.on('unhandledRejection', (reason) => {
	console.error('Main process unhandled rejection:', reason);
});
