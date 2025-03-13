import fs from 'fs';
import { ReadOptions } from './type';

/**
 * Read file content
 * @param options.path Path to the file
 * @returns File content as string
 */
export async function read(options: ReadOptions): Promise<string> {
	const { path: filePath } = options;

	// Ensure file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`File does not exist: ${filePath}`);
	}

	// Ensure path points to a file
	const stats = fs.statSync(filePath);
	if (!stats.isFile()) {
		throw new Error(`Path is not a file: ${filePath}`);
	}

	// Read file content
	return fs.readFileSync(filePath, 'utf-8');
}
