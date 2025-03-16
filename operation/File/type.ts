export interface ListOptions {
    path: string;
    recursive?: boolean;
    depth?: number;  // 递归层数，默认为3，只在recursive为true时生效
    exclude?: string[];  // 排除的文件夹列表
}

export interface FileInfo {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modifiedTime?: Date;
}

export interface ReadOptions {
    path: string;
}

export interface EditOptions {
    action: 'insert' | 'delete' | 'replace';
    path: string;
    content?: string;
    start?: Position;
    end?: Position;
}

export interface CreateOptions {
    path: string;
    content?: string;  // Optional file content
}

export interface SearchOptions {
    path?: string;     // Optional search path, defaults to current directory
    keyword: string;   // Search keyword, supports regex
    exclude?: string[];  // 排除的文件夹列表
}

export interface DownloadOptions {
    url: string;           // 文件下载URL
    path: string;   // 保存文件的本地路径
    overwrite?: boolean;   // 是否覆盖现有文件，默认为false
}

export interface DownloadProgress {
    downloaded: number;    // 已下载的字节数
    total: number;         // 文件总大小（字节）
    percentage: number;    // 下载百分比 (0-100)
    status: 'started' | 'downloading' | 'completed' | 'error';  // 下载状态
}

export type Position = [number, number];  // [row, col]