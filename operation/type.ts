export interface DownloadProgress {
	fileName?: string;
	downloaded: number;    // 已下载的字节数
	total: number;         // 文件总大小（字节）
	percentage: number;    // 下载百分比 (0-100)
	status: 'started' | 'downloading' | 'completed' | 'error';  // 下载状态
}
