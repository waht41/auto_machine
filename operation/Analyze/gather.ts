import { GatherOptions, AnalyzeResult, RawOptions, TransformOptions, FilterOptions, ReduceOptions } from './type';
import { readCsvFile, writeCsvFile, evaluateFunction, parseCsv } from './common';
import fs from 'fs/promises';

/**
 * 处理原始数据生成
 * @param options 原始数据选项
 * @returns 操作结果
 */
export async function handleRawData(options: RawOptions): Promise<AnalyzeResult> {
	try {
		const { content, path: filePath } = options;
        
		// 解析CSV内容
		const parsedData = await parseCsv(content);
        
		// 如果指定了保存路径，则将数据写入文件
		if (filePath) {
			await fs.writeFile(filePath, content);
			return {
				success: true,
				message: `数据已成功保存到 ${filePath}`,
				data: parsedData
			};
		}
        
		// 否则只返回解析后的数据
		return {
			success: true,
			data: parsedData
		};
	} catch (error) {
		console.error(`处理原始数据失败: ${error}`);
		return {
			success: false,
			message: `处理原始数据失败: ${error}`
		};
	}
}

/**
 * 处理数据转换
 * @param options 数据转换选项
 * @returns 操作结果
 */
export async function handleTransform(options: TransformOptions): Promise<AnalyzeResult> {
	try {
		const { from, rule, to } = options;
        
		// 读取源文件数据
		const data = await readCsvFile(from);
        
		// 评估转换规则函数
		const transformFn = evaluateFunction(rule);
        
		// 应用转换规则到每个数据项
		const transformedData = data.map((item: unknown) => transformFn(item));
        
		// 将转换后的数据写入目标文件
		await writeCsvFile(to, transformedData);
        
		return {
			success: true,
			message: `数据已成功转换并保存到 ${to}`,
			data: transformedData
		};
	} catch (error) {
		console.error(`数据转换失败: ${error}`);
		return {
			success: false,
			message: `数据转换失败: ${error}`
		};
	}
}

/**
 * 处理数据过滤
 * @param options 数据过滤选项
 * @returns 操作结果
 */
export async function handleFilter(options: FilterOptions): Promise<AnalyzeResult> {
	try {
		const { from, rule, to } = options;
        
		// 读取源文件数据
		const data = await readCsvFile(from);
        
		// 评估过滤规则函数
		const filterFn = evaluateFunction(rule);
        
		// 应用过滤规则到每个数据项
		const filteredData = data.filter((item: unknown) => filterFn(item));
        
		// 将过滤后的数据写入目标文件
		await writeCsvFile(to, filteredData);
        
		return {
			success: true,
			message: `数据已成功过滤并保存到 ${to}`,
			data: filteredData
		};
	} catch (error) {
		console.error(`数据过滤失败: ${error}`);
		return {
			success: false,
			message: `数据过滤失败: ${error}`
		};
	}
}

/**
 * 处理数据归约/统计
 * @param options 数据归约选项
 * @returns 操作结果
 */
export async function handleReduce(options: ReduceOptions): Promise<AnalyzeResult> {
	try {
		const { from, pairs } = options;
        
		// 读取源文件数据
		const data = await readCsvFile(from);
        
		// 对每个键值对执行归约操作
		const result: Record<string, any> = {};
        
		for (const [key, reduceFnStr] of pairs) {
			// 评估归约函数
			const reduceFn = evaluateFunction(reduceFnStr);
            
			// 执行归约操作
			let accumulator: unknown;
			// 从函数字符串中提取默认值
			const defaultValueMatch = reduceFnStr.match(/\(item,\s*acc\s*=\s*([^)]+)\)/);
			if (defaultValueMatch && defaultValueMatch[1]) {
				try {
					accumulator = JSON.parse(defaultValueMatch[1]);
				} catch (e) {
					// 如果不是有效的 JSON，则尝试作为 JavaScript 表达式求值
					accumulator = eval(defaultValueMatch[1]);
				}
			} else {
				return {
					success: false,
					message: `default acc not found in ${reduceFnStr}`
				};
			}
            
			// 应用归约函数到每个数据项
			for (const item of data) {
				accumulator = reduceFn(item, accumulator);
			}
            
			// 保存结果
			result[key] = accumulator;
		}
        
		return {
			success: true,
			message: `数据归约/统计完成，共处理 ${data.length} 条记录`,
			data: result
		};
	} catch (error) {
		console.error(`数据归约/统计失败: ${error}`);
		return {
			success: false,
			message: `数据归约/统计失败: ${error}`
		};
	}
}

/**
 * 数据收集与处理主函数
 * @param options 数据处理选项
 * @returns 操作结果
 */
export async function gather(options: GatherOptions): Promise<AnalyzeResult> {
	try {
		switch (options.action) {
			case 'raw':
				return await handleRawData(options);
			case 'transform':
				return await handleTransform(options);
			case 'filter':
				return await handleFilter(options);
			case 'reduce':
				return await handleReduce(options);
			default:
				return {
					success: false,
					message: `不支持的操作: ${(options as any).action}`
				};
		}
	} catch (error) {
		console.error(`数据处理失败: ${error}`);
		return {
			success: false,
			message: `数据处理失败: ${error}`
		};
	}
}
