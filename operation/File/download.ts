import fs from 'fs';
import Path from 'path';
import https from 'https';
import http from 'http';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { DownloadOptions, DownloadProgress } from './type';

/**
 * 检查 URL 是否指向可下载的文件
 * @param urlString 要检查的 URL
 * @returns Promise<boolean> 是否可下载
 */
async function checkUrlIsDownloadable(urlString: string): Promise<{ isDownloadable: boolean; finalUrl: string; headers: http.IncomingHttpHeaders }> {
	return new Promise((resolve, reject) => {
		const url = new URL(urlString);
		const protocol = url.protocol === 'https:' ? https : http;
		const options = {
			method: 'HEAD',
			hostname: url.hostname,
			port: url.port,
			path: url.pathname + url.search,
		};

		const req = protocol.request(options, (res) => {
			// 处理重定向
			if (res.statusCode === 301 || res.statusCode === 302) {
				const redirectUrl = res.headers.location;
				if (!redirectUrl) {
					reject(new Error('重定向URL不存在'));
					return;
				}
				// 销毁当前响应，并递归检查重定向后的 URL
				res.destroy();
				checkUrlIsDownloadable(redirectUrl)
					.then(resolve)
					.catch(reject);
				return;
			}

			if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
				const contentDisposition = res.headers['content-disposition'];
				const contentType = res.headers['content-type'];

				// 如果 Content-Disposition 包含 attachment，认为是可下载的
				if (contentDisposition && contentDisposition.includes('attachment')) {
					resolve({ isDownloadable: true, finalUrl: urlString, headers: res.headers });
					return;
				}

				// 如果 Content-Type 表明不是网页或 JSON 等，且没有明确的 attachment，则认为是可下载的
				// 常见可直接下载类型： application/octet-stream, application/zip, image/*, audio/*, video/* 等
				// 常见不可直接下载（通常是网页或API）： text/html, application/json, text/plain (除非有 attachment)
				if (contentType &&
                    !contentType.startsWith('text/html') &&
                    !contentType.startsWith('application/json') &&
                    !(contentType.startsWith('text/plain') && (!contentDisposition || !contentDisposition.includes('attachment')))
				) {
					resolve({ isDownloadable: true, finalUrl: urlString, headers: res.headers });
					return;
				}

				// 其他情况，默认认为不可直接下载 (例如 HTML 页面)
				resolve({ isDownloadable: false, finalUrl: urlString, headers: res.headers });

			} else {
				reject(new Error(`检查URL失败，状态码: ${res.statusCode}`));
			}
		});

		req.on('error', (e) => {
			reject(new Error(`检查URL请求错误: ${e.message}`));
		});

		req.end();
	});
}

/**
 * 下载文件并提供进度更新
 * @param options.url 文件下载URL
 * @param options.destination 保存文件的本地路径
 * @param options.overwrite 是否覆盖现有文件
 * @returns 生成器，用于获取下载进度和最终路径
 */
export async function* download(options: DownloadOptions): AsyncGenerator<DownloadProgress, string, unknown> {
	const { url: initialUrl, path, overwrite = false } = options;

	// 1. 检查 URL 是否可下载
	let checkResult;
	try {
		checkResult = await checkUrlIsDownloadable(initialUrl);
	} catch (error) {
		throw new Error(`无法验证URL: ${error.message}`);
	}

	const { isDownloadable, finalUrl, headers: headHeaders } = checkResult;

	if (!isDownloadable) {
		const contentType = headHeaders['content-type'] || '未知';
		throw new Error(`目标URL似乎不是一个可直接下载的文件 (Content-Type: ${contentType})。URL: ${finalUrl}, 可能需要登录或点击按钮之类的操作。`);
	}

	// 确保目标目录存在
	const dir = Path.dirname(path);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// 检查文件是否已存在
	if (fs.existsSync(path) && !overwrite) {
		throw new Error(`文件已存在: ${path}。设置 overwrite 为 true 可覆盖现有文件。`);
	}

	// 使用最终确认的 URL 进行下载
	const urlToDownload = finalUrl;
	const protocol = urlToDownload.startsWith('https') ? https : http;

	// 2. 发起 GET 请求下载文件
	const response = await new Promise<IncomingMessage>((resolve, reject) => {
		const req = protocol.get(urlToDownload, (res) => {
			// 在GET请求时再次处理重定向（理论上HEAD已处理，但作为保险）
			if (res.statusCode === 301 || res.statusCode === 302) {
				const redirectUrl = res.headers.location;
				if (!redirectUrl) {
					reject(new Error('下载重定向URL不存在'));
					return;
				}
				res.destroy();
				// 注意：这里简单拒绝，因为checkUrlIsDownloadable应该已处理最终URL
				// 如果需要递归下载，逻辑会更复杂
				reject(new Error(`下载请求发生重定向，但HEAD检查应已处理: ${redirectUrl}`));
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