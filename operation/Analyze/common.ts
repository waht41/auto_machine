import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {stringify} from 'csv-stringify/sync';

/**
 * 读取CSV文件内容
 * @param content CSV文件读取的内容
 * @returns 解析后的数据对象数组
 */
export async function parseCsv(content:string):Promise<unknown[]>{
	return parse(content, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
		// 处理带引号的字段和特殊字符
		escape: '\\',  // 使用反斜杠作为转义字符
		quote: '"',
		relax_quotes: true,  // 放宽引号处理规则
		relax_column_count: true,  // 允许不同行有不同列数
		ltrim: true,  // 去除左侧空白
		rtrim: true   // 去除右侧空白
	});
}


export async function readCsvFile(filePath: string): Promise<unknown[]> {
	try {
		const content = await fs.readFile(filePath, 'utf8');
		return await parseCsv(content);
	} catch (error) {
		console.error(`读取CSV文件失败: ${error}`);
		throw new Error(`读取CSV文件失败: ${error}`);
	}
}

/**
 * 将数据写入CSV文件
 * @param filePath 目标文件路径
 * @param data 要写入的数据对象数组
 */
export async function writeCsvFile(filePath: string, data: unknown[] | string): Promise<void> {
	try {
		// 确保目标目录存在
		const dir = path.dirname(filePath);
		if (!fsSync.existsSync(dir)) {
			fsSync.mkdirSync(dir, { recursive: true });
		}
		if (Array.isArray(data)) {
			await fs.writeFile(filePath, await object2Csv(data));
			return;
		}

		await fs.writeFile(filePath, data);


	} catch (error) {
		console.error(`写入CSV文件失败: ${error}`);
		throw new Error(`写入CSV文件失败: ${error}`);
	}
}

export async function object2Csv(data:unknown[]):Promise<string> {
	return stringify(data, {
		header: true,
		escape: '\\',  // 使用反斜杠作为转义字符
		quote: '"',
		quoted: true,  // 为所有字段添加引号
		quoted_empty: true,  // 为空字段添加引号
		quoted_string: true,  // 为字符串字段添加引号
	});
}

/**
 * 执行JavaScript函数字符串
 * @param fnString 函数字符串
 * @returns 可执行的函数
 */
export function evaluateFunction(fnString: string) {
	try {
		// 安全地评估函数字符串
		// eslint-disable-next-line no-new-func
		return new Function('return ' + fnString)();
	} catch (error) {
		console.error(`评估函数失败: ${error}`);
		throw new Error(`评估函数失败: ${error}`);
	}
}
