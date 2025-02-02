import {BrowserWindow, app, ipcMain} from 'electron'
import * as path from 'path'
import {fileURLToPath} from "url";
import {dirname} from "path";
// import app = Electron.app;
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

    ipcMain.on('event-name', (event, data) => {
        // const text = data.toString('utf-8');
        console.log('[waht] receive from main: ',data)
    });


    if (process.env.NODE_ENV === 'development') {
        // 开发环境走Vite服务
        await win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    } else {
        // 生产环境加载构建后的文件
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
    createWindow()
})

//输出当前路径
console.log(path.resolve('.'))

console.log('[waht]',__filename,__dirname)