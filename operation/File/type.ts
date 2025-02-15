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

export type Position = [number, number];  // [row, col]