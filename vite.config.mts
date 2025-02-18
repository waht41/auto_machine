import {resolve} from 'path'
import {defineConfig} from 'vite'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'

const root = process.cwd()
const pathResolve = (path: string) => resolve(__dirname, path)
const alias = [
    {find: '@', replacement: pathResolve('src')},
    {find: '@core', replacement: pathResolve('src/core')},
    {find: 'vscode', replacement: pathResolve('vscode')},
    {find:'@executors', replacement: pathResolve('executors')},
    {find:'@operation', replacement: pathResolve('operation')},
    {find:'@webview', replacement: pathResolve('webview-ui/src')},
]
export default defineConfig({
    resolve: {
        alias: alias,
    },
    plugins: [
        electron([{
            // 主进程入口文件
            entry: resolve(__dirname, 'electron-main/main.ts'),
            vite: {
                resolve: {
                    alias: alias,
                },
                build: {
                    // 主进程输出目录
                    outDir: 'dist-electron',
                    rollupOptions: {
                        // 确保这里指向正确的入口文件（保持为 main.ts）
                        input: resolve(__dirname, 'electron-main/main.ts'),
                        external: ['electron']
                    },
                },
            },
        },
            {
                // 预加载脚本配置
                entry: resolve(__dirname, 'electron-preload/preload.ts'),
                vite: {
                    build: {
                        // 预加载脚本输出目录
                        outDir: 'dist-electron',
                        rollupOptions: {
                            // 确保这里指向正确的入口文件（保持为 main.ts）
                            input: resolve(__dirname, 'electron-preload/preload.ts'),
                            external: ['electron']
                        },
                    },

                },
            }]),
        react()
    ],
    build: {
        // 渲染进程输出目录（与原配置保持一致）
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            external: ['electron']
        }
    },
    optimizeDeps: {
        exclude: ['puppeteer-chromium-resolver']
    },
    server: {
        fs: {
            strict: false
        }
    }
})
