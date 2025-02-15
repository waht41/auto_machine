import { ListOptions, FileInfo } from "./type";
import fs from 'fs';
import path from 'path';
import { shouldExclude } from "./common";

export async function list(options: ListOptions): Promise<FileInfo[]> {
    const {path: dirPath, recursive = false, depth = 3, exclude = []} = options;

    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
    }

    // Ensure path points to a directory
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const results: FileInfo[] = [];

    /**
     * Recursive function to list directory contents
     */
    function listDirectory(currentPath: string, currentDepth: number) {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);

            // 检查是否应该排除
            if (shouldExclude(fullPath, exclude)) {
                continue;
            }

            const itemStats = fs.statSync(fullPath);
            const fileInfo: FileInfo = {
                name: item,
                path: fullPath,
                type: itemStats.isDirectory() ? 'directory' : 'file',
                size: itemStats.isFile() ? itemStats.size : undefined,
                modifiedTime: itemStats.mtime
            };

            results.push(fileInfo);

            if (recursive && itemStats.isDirectory() && currentDepth < depth) {
                listDirectory(fullPath, currentDepth + 1);
            }
        }
    }

    listDirectory(dirPath, 0);
    return results;
}
