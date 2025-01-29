import {BrowserWindow, app} from 'electron'
import * as path from 'path'
// import app = Electron.app;
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600
    })

    // win.loadFile('index.html')
    if (process.env.NODE_ENV === 'development') {
        // 开发环境走Vite服务
        win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    } else {
        // 生产环境加载构建后的文件
        win.loadFile(
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