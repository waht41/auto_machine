import { getPage } from './common';
import { BrowserResult, DownloadOptions, DownloadProgress } from './type';
import path from 'path';
import fs from 'fs';
import { interact } from '@operation/Browser/interact';
import type { Download } from 'playwright';

// 配置常量
const DEFAULT_DOWNLOAD_DIR = './download';
const DIRECTORY_PERMISSION = 0o755;
const WINDOWS_RETRY_DELAY = 1000;
const DEFAULT_FILENAME_PREFIX = 'download';

// 新增字节格式化函数
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log2(bytes) / 10);
	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export async function* browserDownload(options: DownloadOptions) {
	const { targetDir, userFilename } = parseUserPath(options.path);
	ensureDirectoryExists(targetDir);
	yield* handleBrowserDownload(options, targetDir, userFilename);
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
async function* handleBrowserDownload(
	options: DownloadOptions,
	targetDir: string,
	userFilename?: string
): AsyncGenerator<DownloadProgress, BrowserResult, unknown> {
	const page = await getPage({ url: options.url });
	
	// 初始进度
	yield {
		downloaded: 0,
		total: 0,
		percentage: 0,
		status: 'started'
	};
	
	// 同时执行下载事件监听和点击操作
	const downloadPromise = page.waitForEvent('download');
	const interactPromise = interact({ ...options, action: 'click' });
	
	// 等待点击操作完成和下载事件触发
	const [download] = await Promise.all([
		downloadPromise,
		interactPromise
	]);

	const filename = userFilename || download.suggestedFilename() || generateTimestampFilename();
	const downloadPath = path.join(targetDir, sanitizeFilename(filename));

	// 下载中进度
	yield {
		downloaded: 0,
		total: 0, // 浏览器下载无法获取总大小
		percentage: 50, // 假设进度为50%
		status: 'downloading'
	};

	try {
		await download.saveAs(downloadPath);
	} catch (error) {
		if (process.platform === 'win32') {
			await handleWindowsRetry(download, downloadPath);
		} else {
			throw error;
		}
	}

	const fileSize = fs.statSync(downloadPath).size;
	
	// 完成进度
	yield {
		downloaded: fileSize,
		total: fileSize,
		percentage: 100,
		status: 'completed'
	};

	console.log(`✅ 下载完成: ${path.basename(downloadPath)}`);
	console.log(`📄 文件大小: ${formatBytes(fileSize)}`);
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

/** 确保目录存在 */
function ensureDirectoryExists(dirPath: string): void {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, {
			recursive: true,
			mode: DIRECTORY_PERMISSION
		});
	}
}

/** 处理Windows系统重试逻辑 */
async function handleWindowsRetry(
	download: Download,
	downloadPath: string
): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, WINDOWS_RETRY_DELAY));
	await download.saveAs(downloadPath);
}
