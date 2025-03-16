import fs from 'fs';
import Path from 'path';
import https from 'https';
import http from 'http';
import { IncomingMessage } from 'http';
import { DownloadOptions, DownloadProgress } from './type';

/**
 * 下载文件并提供进度更新
 * @param options.url 文件下载URL
 * @param options.destination 保存文件的本地路径
 * @param options.overwrite 是否覆盖现有文件
 * @returns 生成器，用于获取下载进度和最终路径
 */

export async function* download(options: DownloadOptions): AsyncGenerator<DownloadProgress, string, unknown> {
	const { url, path, overwrite = false } = options;

	// 确保目标目录存在
	const dir = Path.dirname(path);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// 检查文件是否已存在
	if (fs.existsSync(path) && !overwrite) {
		throw new Error(`文件已存在: ${path}。设置 overwrite 为 true 可覆盖现有文件。`);
	}

	const protocol = url.startsWith('https') ? https : http;
	const response = await new Promise<IncomingMessage>((resolve, reject) => {
		const req = protocol.get(url, (res) => {
			// 自动处理重定向
			if (res.statusCode === 301 || res.statusCode === 302) {
				const redirectUrl = res.headers.location;
				if (!redirectUrl) {
					reject(new Error('重定向URL不存在'));
					return;
				}
				// 关闭当前响应
				res.destroy();
				// 递归处理重定向
				protocol.get(redirectUrl, redirectRes => resolve(redirectRes)).on('error', reject);
				return;
			}
			resolve(res);
		});
		req.on('error', reject);
	});

	// 检查响应状态
	if (response.statusCode !== 200) {
		throw new Error(`下载失败，状态码: ${response.statusCode}`);
	}

	const totalSize = parseInt(response.headers['content-length'] || '0', 10);
	let downloadedSize = 0;

	// 创建文件写入流
	const fileStream = fs.createWriteStream(path);

	try {
		// 初始进度
		yield {
			downloaded: 0,
			total: totalSize,
			percentage: 0,
			status: 'started'
		};

		// 使用异步迭代器处理响应数据
		for await (const chunk of response) {
			downloadedSize += chunk.length;
			const canContinue = fileStream.write(chunk);
			// 处理背压
			if (!canContinue) {
				await new Promise(resolve => fileStream.once('drain', resolve));
			}
			// 更新进度
			yield {
				downloaded: downloadedSize,
				total: totalSize,
				percentage: totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0,
				status: 'downloading'
			};
		}

		// 完成写入
		fileStream.end();
		await new Promise((resolve, reject) => {
			fileStream.on('finish', resolve);
			fileStream.on('error', reject);
		});

		// 最终进度
		yield {
			downloaded: downloadedSize,
			total: totalSize,
			percentage: 100,
			status: 'completed'
		};

		return path;
	} catch (error) {
		// 发生错误时清理文件
		fileStream.close();
		fs.unlink(path, () => {}); // 尝试删除文件，忽略错误
		throw error;
	}
}

/**
 * 简化版下载函数，不提供进度更新
 * @param options.url 文件下载URL
 * @param options.destination 保存文件的本地路径
 * @param options.overwrite 是否覆盖现有文件
 * @returns 下载完成后的文件路径
 */
export async function downloadFile(options: DownloadOptions): Promise<DownloadProgress> {
	const generator = download(options);
	let value: DownloadProgress | undefined; // Initialize with undefined

	for await (const process of generator) {
		value = process;
	}

	if (value === undefined) {
		// Handle the case where the generator didn't yield any values.
		// This might mean the download failed immediately or the generator was empty.
		throw new Error('Download did not produce any progress updates.');
	}

	return value;
}