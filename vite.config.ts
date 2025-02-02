import {resolve} from 'path'
import {defineConfig} from 'vite'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'

const root = process.cwd()
const pathResolve = (path: string) => resolve(root, path)

export default defineConfig({
    resolve: {
        alias: [
            {find: '@', replacement: pathResolve('src')},
            {find: '@core', replacement: pathResolve('src/core')},
        ],
    },
    plugins: [
        electron([{
            // 主进程入口文件
            entry: resolve(__dirname, 'src/main.ts'),
            vite: {
                build: {
                    // 主进程输出目录
                    outDir: 'dist-electron',
                    rollupOptions: {
                        // 确保这里指向正确的入口文件（保持为 main.ts）
                        input: resolve(__dirname, 'src/main.ts'),
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
                    },
                },
            }]),
        react()
    ],
    build: {
        // 渲染进程输出目录（与原配置保持一致）
        outDir: 'dist',
        assetsDir: 'assets',
    }
})
