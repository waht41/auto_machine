import { build } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function buildBackground() {
    await build({
        configFile: false, // 禁用加载默认的 vite.config.mjs
        build: {
            lib: {
                entry: resolve(__dirname, '../src/background-worker/hello.ts'),
                formats: ['es'],
                fileName: () => 'hello.js'
            },
            outDir: 'dist-electron/background',
            rollupOptions: {
                input: resolve(__dirname, '../src/background-worker/hello.ts'), // 强制单入口
                output: {
                    entryFileNames: 'hello.js' // 固定输出文件名
                },
                external: [
                    'electron',
                    'node:child_process',
                    'node:path'
                ]
            }
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, '../src')
            }
        }
    })
}

buildBackground().catch(console.error)
