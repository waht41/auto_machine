import { getPage } from './common';
import { BrowserResult, DownloadOptions } from './type';
import * as path from 'path';
import fs from "node:fs";
import https from 'node:https';
import http from 'node:http';
import { interact } from "@operation/Browser/interact";

export async function download(options: DownloadOptions): Promise<BrowserResult> {
    const targetDir = path.resolve(options.path ? path.dirname(options.path) : './download');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 }); // 显式设置权限
    }

    if (options.selector || options.tag || options.text || options.id) {
        const page = await getPage({ url: options.url });
        const [download] = await Promise.all([
            page.waitForEvent('download'),
        ]);
        const filename = download.suggestedFilename();
        const downloadPath = path.join(targetDir, filename);
        await interact({ ...options, action: 'click' });
        try {
            await download.saveAs(downloadPath);
        } catch (error) {
            // 处理 Windows 文件锁问题
            if (process.platform === 'win32') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await download.saveAs(downloadPath);
            } else {
                throw error;
            }
        }
        await page.close();
        return { success: true, data: downloadPath };
    } else {
        // 直接下载静态资源
        return new Promise((resolve, reject) => {
            const urlObj = new URL(options.url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            protocol.get(options.url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                const contentDisposition = response.headers['content-disposition'];
                let filename = '';
                
                if (contentDisposition) {
                    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                    if (matches && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }
                
                if (!filename) {
                    filename = path.basename(urlObj.pathname);
                }
                
                if (!filename) {
                    filename = 'download';
                }

                const downloadPath = path.join(targetDir, filename);
                const fileStream = fs.createWriteStream(downloadPath);

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve({ success: true, data: downloadPath });
                });

                fileStream.on('error', (error) => {
                    fs.unlink(downloadPath, () => {
                        reject(error);
                    });
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }
}
