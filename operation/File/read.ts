import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';
import { ReadOptions } from './type';

// 初始化 PDF.js worker
const initPdfWorker = () => {
	try {
		// Node.js 环境
		const workerPath = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build', 'pdf.worker.js');
		pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
	} catch (error) {
		console.error('Failed to initialize PDF.js worker:', error);
	}
};

/**
 * 使用 PDF.js 解析 PDF 文件
 * @param dataBuffer PDF 文件的二进制数据
 * @returns 提取的文本内容
 */
async function parsePdfWithPdfJs(dataBuffer: Buffer): Promise<string> {
	// 确保 worker 已初始化
	if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
		initPdfWorker();
	}
  
	// 将 Buffer 转换为 Uint8Array
	const uint8Array = new Uint8Array(dataBuffer);
  
	// 加载 PDF 文档
	const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
	const pdfDocument = await loadingTask.promise;
  
	// 提取文本内容
	let textContent = '';
	for (let i = 1; i <= pdfDocument.numPages; i++) {
		const page = await pdfDocument.getPage(i);
		const content = await page.getTextContent();
		const strings = content.items.map(item => 'str' in item ? item.str : '');
		textContent += strings.join(' ') + '\n';
	}
  
	return textContent;
}

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

	// Check if file is a PDF
	const fileExtension = path.extname(filePath).toLowerCase();
	if (fileExtension === '.pdf') {
		// Read PDF file
		const dataBuffer = fs.readFileSync(filePath);
		try {
			return await parsePdfWithPdfJs(dataBuffer);
		} catch (error) {
			throw new Error(`Failed to parse PDF file: ${error.message}`);
		}
	}

	// Read regular file content
	return fs.readFileSync(filePath, 'utf-8');
}
