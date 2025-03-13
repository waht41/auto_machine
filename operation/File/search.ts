import * as fs from 'fs';
import * as path from 'path';
import { SearchOptions, FileInfo } from './type';
import { shouldExclude } from './common';

/**
 * Search for files containing the specified keyword
 * @param options.path Optional search path, defaults to current directory
 * @param options.keyword Search keyword, supports regex
 * @param options.exclude Optional list of directories or patterns to exclude
 * @returns Array of matching FileInfo objects
 */
export async function search(options: SearchOptions): Promise<FileInfo[]> {
	const { 
		path: searchPath = process.cwd(), 
		keyword,
		exclude = []
	} = options;

	// Ensure search path exists
	if (!fs.existsSync(searchPath)) {
		throw new Error(`Search path does not exist: ${searchPath}`);
	}

	// Ensure path points to a directory
	const stats = fs.statSync(searchPath);
	if (!stats.isDirectory()) {
		throw new Error(`Search path is not a directory: ${searchPath}`);
	}

	// Create RegExp from keyword if it's a regex pattern
	let regex: RegExp | null = null;
	if (keyword.startsWith('/') && keyword.indexOf('/', 1) !== -1) {
		try {
			const lastSlashIndex = keyword.lastIndexOf('/');
			const pattern = keyword.slice(1, lastSlashIndex);
			const flags = keyword.slice(lastSlashIndex + 1);
			regex = new RegExp(pattern, flags);
		} catch (error) {
			throw new Error(`Invalid regex pattern: ${keyword}`);
		}
	}

	/**
     * Check if a path should be excluded
     */


	const results: FileInfo[] = [];

	/**
     * Recursive function to search through directories
     */
	function searchDirectory(dirPath: string) {
		const items = fs.readdirSync(dirPath);

		for (const item of items) {
			const fullPath = path.join(dirPath, item);

			// 检查是否应该排除
			if (shouldExclude(fullPath,exclude)) {
				continue;
			}

			const itemStats = fs.statSync(fullPath);

			if (itemStats.isDirectory()) {
				// Recursively search subdirectories
				searchDirectory(fullPath);
			} else if (itemStats.isFile()) {
				// Check if file name matches the keyword
				const isMatch = regex 
					? regex.test(item)  // Use regex if provided
					: item.includes(keyword);  // Simple string include otherwise

				if (isMatch) {
					results.push({
						name: item,
						path: fullPath,
						type: 'file',
						size: itemStats.size,
						modifiedTime: itemStats.mtime
					});
				}
			}
		}
	}

	// Start recursive search
	searchDirectory(searchPath);
	return results;
}
