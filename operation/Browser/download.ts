import { getPage } from './common';
import { BrowserResult, DownloadOptions } from './type';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { interact } from "@operation/Browser/interact";
import { promisify } from 'util';
import { pipeline } from 'stream';

// 配置常量
const DEFAULT_DOWNLOAD_DIR = './download';
const DIRECTORY_PERMISSION = 0o755;
const WINDOWS_RETRY_DELAY = 1000;
const DEFAULT_FILENAME_PREFIX = 'download';

// 流管道异步化
const asyncPipeline = promisify(pipeline);

export async function download(options: DownloadOptions): Promise<BrowserResult> {
    const { targetDir, userFilename } = parseUserPath(options.path);
    ensureDirectoryExists(targetDir);

    return shouldUseBrowserDownload(options)
        ? handleBrowserDownload(options, targetDir, userFilename)
        : handleDirectDownload(options.url, targetDir, userFilename);
}

/** 解析用户路径 */
function parseUserPath(userPath?: string): { targetDir: string; userFilename?: string } {
    if (!userPath) {
        return { targetDir: path.resolve(DEFAULT_DOWNLOAD_DIR) };
    }

    // 判断是否为目录路径（以路径分隔符结尾）
    if (userPath.endsWith(path.sep)) {
        return { targetDir: path.resolve(userPath) };
    }

    const parsed = path.parse(userPath);
    return {
        targetDir: path.resolve(parsed.dir),
        userFilename: parsed.base || undefined
    };
}

/** 处理浏览器交互下载 */
async function handleBrowserDownload(
    options: DownloadOptions,
    targetDir: string,
    userFilename?: string
): Promise<BrowserResult> {
    const page = await getPage({ url: options.url });
    const [download] = await Promise.all([page.waitForEvent('download')]);

    // 生成最终文件名
    const filename = userFilename || download.suggestedFilename() || generateTimestampFilename();
    const downloadPath = path.join(targetDir, sanitizeFilename(filename));

    await interact({ ...options, action: 'click' });

    try {
        await download.saveAs(downloadPath);
    } catch (error) {
        if (process.platform === 'win32') {
            await handleWindowsRetry(download, downloadPath);
        } else {
            throw error;
        }
    }

    await page.close();
    return { success: true, data: downloadPath };
}

/** 处理直接下载 */
async function handleDirectDownload(
    url: string,
    targetDir: string,
    userFilename?: string
): Promise<BrowserResult> {
    const protocol = getProtocol(url);
    const response = await fetchResponse(url, protocol);
    validateResponseStatus(response, url);

    // 生成最终文件名
    const responseFilename = extractFilename(response, url);
    const filename = userFilename || responseFilename || generateTimestampFilename();
    const downloadPath = path.join(targetDir, sanitizeFilename(filename));

    await saveFile(response, downloadPath);
    return { success: true, data: downloadPath };
}

/** 生成带时间戳的默认文件名 */
function generateTimestampFilename(): string {
    const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);
    return `${DEFAULT_FILENAME_PREFIX}_${timestamp}`;
}

// 其他辅助函数保持原有实现，仅添加文件名处理逻辑
function sanitizeFilename(filename: string): string {
    return filename.replace(/[\\/:"*?<>|]/g, '_');
}

/** 获取目标下载目录 */
function getTargetDirectory(userPath?: string): string {
    return path.resolve(
        userPath ? path.dirname(userPath) : DEFAULT_DOWNLOAD_DIR
    );
}

/** 确保目录存在 */
function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {
            recursive: true,
            mode: DIRECTORY_PERMISSION
        });
    }
}

/** 判断是否需要使用浏览器下载 */
function shouldUseBrowserDownload(options: DownloadOptions): boolean {
    return !!(options.selector || options.tag || options.text || options.id);
}

/** 处理Windows系统重试逻辑 */
async function handleWindowsRetry(
    download: any,
    downloadPath: string
): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, WINDOWS_RETRY_DELAY));
    await download.saveAs(downloadPath);
}

/** 获取协议处理器 */
function getProtocol(url: string) {
    return new URL(url).protocol === 'https:' ? https : http;
}

/** 获取网络响应 */
async function fetchResponse(
    url: string,
    protocol: typeof http | typeof https
): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        const req = protocol.get(url, {
            timeout: 30_000, // 添加超时限制
            agent: new protocol.Agent({
                keepAlive: true, // 启用连接复用
                maxSockets: 6    // 增加并发连接数
            })
        });

        req.on('response', resolve);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.on('error', reject);
    });
}


/** 验证响应状态 */
function validateResponseStatus(
    response: http.IncomingMessage,
    url: string
): void {
    if (response.statusCode !== 200) {
        throw new Error(
            `下载失败: ${url} (状态码: ${response.statusCode})`
        );
    }
}

/** 提取文件名 */
function extractFilename(
    response: http.IncomingMessage,
    url: string
): string {
    const header = response.headers['content-disposition'] || '';
    const urlFallback = path.basename(new URL(url).pathname) || 'download';
    return parseContentDisposition(header) || urlFallback;
}

/** 解析Content-Disposition头 */
function parseContentDisposition(header: string): string | null {
    const filenameMatch = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return filenameMatch?.[1].replace(/^"+|"+$/g, '') || null;
}

/** 生成完整下载路径 */
function getDownloadPath(directory: string, filename: string): string {
    return path.join(directory, sanitizeFilename(filename));
}


/** 保存文件到本地 */
async function saveFile(
    response: http.IncomingMessage,
    filePath: string
): Promise<void> {
    const fileStream = fs.createWriteStream(filePath);

    try {
        await asyncPipeline(response, fileStream);
    } finally {
        fileStream.close();
    }
}