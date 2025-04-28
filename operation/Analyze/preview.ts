import fs from 'fs/promises';
import { PreviewOptions, AnalyzeResult } from './type';

/**
 * 预览 CSV 文件内容
 * @param options 预览选项，包含文件路径和预览行范围
 * @returns 操作结果，包含预览数据
 */
export type PreviewResult = AnalyzeResult<{
	lines: string[];
	range: {
		start: number;
		end: number;
		total: number;
	};
}>;

export async function preview(options: PreviewOptions): Promise<PreviewResult> {
	try {
		const { path: filePath, lines } = options;
		
		// 读取文件内容
		const content = await fs.readFile(filePath, 'utf8');
		
		// 按行分割内容
		const allLines = content.split(/\r?\n/);
		
		// 计算实际的开始和结束行
		const start = lines.start >= 0 ? lines.start : allLines.length + lines.start;
		const end = lines.end >= 0 ? lines.end : allLines.length + lines.end;
		
		// 确保开始和结束行在有效范围内
		const validStart = Math.max(0, start);
		const validEnd = Math.min(allLines.length - 1, end);
		
		// 如果开始行大于结束行或者超出范围，返回错误
		if (validStart > validEnd || validStart >= allLines.length) {
			return {
				success: false,
				message: `Invalid line range: start line ${lines.start}(${validStart}), end line ${lines.end}(${validEnd}), total lines ${allLines.length}`
			};
		}
		
		// 提取指定范围的行
		const selectedLines = allLines.slice(validStart, validEnd + 1);
		
		// 如果选择的范围不包含第0行（标题行），则将其添加到结果中
		const headerLine = allLines[0];
		const resultLines = validStart === 0 ? selectedLines : [headerLine, ...selectedLines];
		
		return {
			success: true,
			message: `Successfully previewed file ${filePath} from line ${validStart} to ${validEnd}`,
			data: {
				range: {
					start: validStart,
					end: validEnd,
					total: allLines.length
				},
				lines: resultLines,
			}
		};
	} catch (error) {
		console.error(`Failed to preview file: ${error}`);
		return {
			success: false,
			message: `Failed to preview file: ${error}`
		};
	}
}