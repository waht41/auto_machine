import * as fs from 'fs';
import { EditOptions } from './type';

/**
 * Edit file content
 * @param options.action Action type: insert|delete|replace
 * @param options.path Path to the file
 * @param options.content Content to insert or replace
 * @param options.start Start position [row, col]
 * @param options.end End position [row, col]
 */
export async function edit(options: EditOptions): Promise<string> {
	const {action, path: filePath, content, start = [1, 1], end} = options;

	// Ensure file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`File does not exist: ${filePath}`);
	}

	// Read original file content
	let fileContent = fs.readFileSync(filePath, 'utf-8');
	const lines = fileContent.split('\n');

	// Convert position to zero-based index
	// Special handling for -1 case which indicates end of file
	const getRow = (row: number) => row === -1 ? lines.length - 1 : row - 1;
	const getCol = (row: number, col: number) => col === -1 ? (lines[getRow(row)].length ?? 0) : col - 1;
	const [startRow, startCol] = [getRow(start[0]), getCol(start[0], start[1])];
	const [endRow, endCol] = end ? [getRow(end[0]), getCol(end[0], end[1])] : [getRow(-1), getCol(-1, -1)];

	switch (action) {
		case 'insert': {
			if (!content) throw new Error('Content is required for insert operation');
			while (lines.length <= startCol) {
				lines.push('');
			}
			// Insert content at specified position
			let line = lines[startRow];
			if (line.length < startCol) {
				lines[startRow] += ' '.repeat(startCol - line.length);
				line = lines[startRow];
			}

			lines[startRow] = line.slice(0, startCol) + content + line.slice(startCol);
			fileContent = lines.join('\n');
			break;
		}
		case 'delete': {
			if (!end) throw new Error('End position is required for delete operation');

			if (startRow === endRow) {
				// Delete within the same line
				const line = lines[startRow];
				lines[startRow] = line.slice(0, startCol) + line.slice(endCol);
			} else {
				// Delete across multiple lines
				lines[startRow] = lines[startRow].slice(0, startCol);
				lines[endRow] = lines[endRow].slice(endCol+1);
				lines[startRow] += lines[endRow];
				lines.splice(startRow + 1, endRow - startRow);


			}
			fileContent = lines.join('\n');
			break;
		}
		case 'replace': {
			if (!content) throw new Error('Content is required for replace operation');
			if (!end) throw new Error('End position is required for replace operation');

			if (startRow === endRow) {
				// Replace within the same line
				const line = lines[startRow];
				lines[startRow] = line.slice(0, startCol) + content + line.slice(endCol);
			} else {
				// Replace across multiple lines
				lines[startRow] = lines[startRow].slice(0, startCol) + content;
				lines.splice(startRow + 1, endRow - startRow);
			}
			fileContent = lines.join('\n');
			break;
		}
		default:
			throw new Error(`Unsupported action type: ${action}`);
	}

	// Write to file
	fs.writeFileSync(filePath, fileContent, 'utf-8');
	return 'success';
}
