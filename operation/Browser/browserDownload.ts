import { getPage } from './common';
import { BrowserResult, DownloadOptions } from './type';
import path from 'path';
import fs from 'fs';
import { interact } from '@operation/Browser/interact';
import type { Download } from 'playwright';
import { DownloadProgress } from '@operation/type';

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

	try {
		yield* streamDownload(download, downloadPath);
	} catch (error) {
		if (process.platform === 'win32') {
			yield* handleWindowsRetry(download, downloadPath);
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
async function* handleWindowsRetry(
	download: Download,
	downloadPath: string
) {
	await new Promise(resolve => setTimeout(resolve, WINDOWS_RETRY_DELAY));
	yield* streamDownload(download, downloadPath);
}

/**
 * 流式下载实现，提供实时进度更新
 * @param download Playwright下载对象
 * @param downloadPath 目标保存路径
 */
async function* streamDownload(
	download: Download,
	downloadPath: string
): AsyncGenerator<DownloadProgress, void, unknown> {
	// 创建临时文件路径，下载完成后再重命名
	const tempPath = `${downloadPath}.temp`;
	
	// 创建可写流
	const writeStream = fs.createWriteStream(tempPath);
	
	// 获取下载流
	const readStream = await download.createReadStream();
	if (!readStream) {
		yield {
			downloaded: 0,
			total: 0,
			percentage: 0,
			status: 'error'
		};
		throw new Error('无法创建下载流');
	}
	
	// 初始化下载状态
	let downloadedBytes = 0;
	let totalBytes = 0;
	
	// 对于blob URL，无法直接获取文件大小
	// 不再尝试获取总大小，而是专注于显示已下载的字节数
	const downloadUrl = download.url();
	if (downloadUrl && !downloadUrl.startsWith('blob:')) {
		try {
			// 只对非blob URL尝试获取大小
			const context = download.page().context();
			try {
				// 只处理http和https协议
				if (downloadUrl.startsWith('http:') || downloadUrl.startsWith('https:')) {
					const response = await context.request.head(downloadUrl, {
						timeout: 5000,
						failOnStatusCode: false
					});
					
					const contentLengthHeader = response.headers()['content-length'];
					if (contentLengthHeader) {
						totalBytes = parseInt(contentLengthHeader, 10);
					}
				}
			} catch (requestError) {
				console.warn('无法通过HEAD请求获取文件大小:', requestError);
			}
		} catch (error) {
			console.warn('无法获取文件总大小:', error);
		}
	}
	
	// 监听数据块事件
	readStream.on('data', (chunk) => {
		downloadedBytes += chunk.length;
		
		// 背压处理 - 如果写入流缓冲区已满，暂停读取
		if (!writeStream.write(chunk) && readStream.pause) {
			readStream.pause();
		}
	});
	
	// 当写入流准备好接收更多数据时，恢复读取
	writeStream.on('drain', () => {
		if (readStream.resume) {
			readStream.resume();
		}
	});
	
	// 设置进度监控间隔
	const monitorDownloadProgress = async function*(): AsyncGenerator<DownloadProgress, void, unknown> {
		let lastReportedBytes = 0;
		const startTime = Date.now();
		
		while (readStream.readable) {
			// 计算下载百分比 - 如果没有总大小，则基于已下载量提供进度感知
			let percentage = 0;
			if (totalBytes > 0) {
				percentage = Math.min(Math.floor((downloadedBytes / totalBytes) * 100), 99);
			} else {
				// 如果没有总大小，使用基于时间的模拟进度
				// 随着时间推移，进度会越来越慢地增加，但永远不会达到100%
				const elapsedSeconds = (Date.now() - startTime) / 1000;
				const progressRate = downloadedBytes > lastReportedBytes ? 0.8 : 0.3; // 如果有新数据下载，进度增长更快
				percentage = Math.min(Math.floor(90 * (1 - Math.exp(-progressRate * elapsedSeconds))), 99);
			}
			
			// 记录本次报告的字节数，用于检测下载是否有进展
			lastReportedBytes = downloadedBytes;
			
			yield {
				downloaded: downloadedBytes,
				total: totalBytes || 0,
				percentage,
				status: 'downloading'
			};
			
			// 等待一小段时间再更新进度
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	};
	
	// 启动进度监控，但不阻塞后续代码执行
	const progressMonitor = monitorDownloadProgress();
	
	// 转发进度更新，直到进度监控结束
	try {
		for await (const progress of progressMonitor) {
			yield progress;
		}
	} catch (error) {
		console.error('进度监控错误:', error);
	}
	
	// 关闭写入流
	await new Promise((resolve) => {
		writeStream.end(resolve);
	});
	
	// 重命名临时文件为最终文件
	try {
		// 如果目标文件已存在，先删除
		if (fs.existsSync(downloadPath)) {
			fs.unlinkSync(downloadPath);
		}
		fs.renameSync(tempPath, downloadPath);
		
		// 获取最终文件大小
		const finalSize = fs.statSync(downloadPath).size;
		
		// 下载完成时发送完成状态
		yield {
			downloaded: finalSize,
			total: finalSize, // 使用实际大小作为总大小
			percentage: 100,
			status: 'completed'
		};
	} catch (error) {
		console.error('重命名文件失败:', error);
		throw error;
	}
}