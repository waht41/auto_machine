import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { join } from 'path';
import { createMenu } from '@/menu';
import { ChildProcess, fork } from 'child_process';
import chokidar from 'chokidar';

function createHelloWorker(): ChildProcess {
    const isDev = process.env.NODE_ENV === 'development';
    const workerPath = join(__dirname,
        isDev ? '../src/background-worker/start-background.ts'
            : './background/start-background.js'
    );

    let worker: ChildProcess | null = null;

    function startWorker() {
        worker = fork(workerPath, [], {
            execArgv: isDev ? ['--import', 'tsx'] : []
        });
    }

    function restartWorker() {
        if (worker) {
            worker.kill();
        }
        startWorker();
    }

    startWorker();

    if (isDev) {
        const watcher = chokidar.watch(workerPath, {
            ignored: /(^|[\/\\])\../, // 忽略隐藏文件
            persistent: true
        });

        watcher.on('change', (path) => {
            console.log(`File ${path} has been changed. Restarting worker...`);
            restartWorker();
        });
    }

    return worker!;
}

const createWindow = async (worker: ChildProcess) => {
    const win = new BrowserWindow({
        width: 1600,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 注入 preload 脚本
            contextIsolation: true,                      // 启用上下文隔离
        }
    })

    // 创建并应用菜单
    createMenu(win);

    //接受来自渲染进程的消息，并转发给 worker
    ipcMain.on('message', async (event, data) => {
        worker.send(data);
    });

    //接受来自 worker 的消息，并转发给渲染进程
    worker.on('message', (message) => {
        console.log('[waht] main receive from worker:', message);
        win.webContents.send('message', message);
    })


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
    const worker = createHelloWorker()
    createWindow(worker)
})
