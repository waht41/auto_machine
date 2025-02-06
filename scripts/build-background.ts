import { build } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function buildBackground() {
    await build({
        build: {
            lib: {
                entry: resolve(__dirname, '../src/background-worker/hello.ts'),
                formats: ['es'],
                fileName: () => 'hello.js'
            },
            outDir: 'dist-electron/background',
            rollupOptions: {
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
