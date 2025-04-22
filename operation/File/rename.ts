import * as fs from 'fs';
import * as path from 'path';
import { RenameOptions } from './type';

/**
 * 重命名文件或目录
 * @param options.path 原文件或目录的路径
 * @param options.name 新的文件或目录名称
 * @returns 重命名操作的结果，成功返回'success'
 */
export async function rename(options: RenameOptions): Promise<string> {
	const { path: filePath, name } = options;

	// 确保源文件/目录存在
	if (!fs.existsSync(filePath)) {
		throw new Error(`源文件或目录不存在: ${filePath}`);
	}

	// 获取父目录路径
	const parentDir = path.dirname(filePath);
    
	// 构建新路径
	const newPath = path.join(parentDir, name);
    
	// 检查目标路径是否已存在
	if (fs.existsSync(newPath)) {
		throw new Error(`目标路径已存在: ${newPath}`);
	}
  
	fs.renameSync(filePath, newPath);
	return newPath;
}
