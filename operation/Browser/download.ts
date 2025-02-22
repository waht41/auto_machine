import { getPage } from './common';
import { BrowserResult, DownloadOptions } from './type';
import * as path from 'path';
import fs from "node:fs";

export async function download(options: DownloadOptions): Promise<BrowserResult> {
    const page = await getPage({ url: options.url, userDataDir: options.userDataDir });


    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.goto(options.url)
    ]);

    const filename = download.suggestedFilename();
    const targetDir = path.resolve(options.path ? path.dirname(options.path) : './download');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 }); // 显式设置权限
    }
    const downloadPath = path.join(targetDir, filename);

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
    return { success: true };
}
