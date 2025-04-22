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

export interface RenameOptions {
    path: string;       // 原文件或目录的路径
    name: string;       // 新的文件或目录名称
}

export type Position = [number, number];  // [row, col]