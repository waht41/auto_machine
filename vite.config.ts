import { resolve } from 'path'
// 使用 defineConfig 工具函数，这样不用 jsdoc 注解也可以获取类型提示
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'

/** 当前执行 node 命令时文件夹的地址（工作目录） */
const root: string = process.cwd()

/** 路径拼接函数，简化代码 */
const pathResolve = (path: string): string => resolve(root, path)

export default defineConfig({
    resolve: {
        alias: [
            /** 设置 `@` 指向 `src` 目录 */
            { find: '@', replacement: pathResolve('src') },
            { find: '@core', replacement: pathResolve('src/core') },
        ],
    },
    plugins: [
        electron({
            entry: resolve(__dirname, 'src/main.ts'),
        }),
    ],
    build: {
        outDir: 'dist', // 输出目录
        assetsDir: 'assets', // 资源目录
        rollupOptions: { input: 'src/main.js' } // rollup的入口文件，应为 main.js，而非 main.ts，因为 Electron 的主进程应使用 .js 文件。
    }
})