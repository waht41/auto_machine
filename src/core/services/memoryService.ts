import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { Memory, SearchOption } from './type';
import { sanitizeFileName } from '../storage/common';

export class MemoryService {
	static serviceId: string = 'MemoryService';
	private memories: Memory[] = [];

	constructor(private savePath: string) {
	}

	async init() {
		await fs.mkdir(this.savePath, { recursive: true });
		await this.loadMemory();
	}

	private async loadMemory() { //遍历savePath下所有的yaml文件，加载对应的memory
		try {
			this.memories = [];
			
			// 递归读取文件的辅助函数
			const readFilesRecursively = async (directory: string) => {
				const entries = await fs.readdir(directory, { withFileTypes: true });
				
				for (const entry of entries) {
					const fullPath = path.join(directory, entry.name);
					
					if (entry.isDirectory()) {
						// 递归处理子目录
						await readFilesRecursively(fullPath);
					} else if (entry.isFile() && 
						(path.extname(entry.name).toLowerCase() === '.yaml' || 
						path.extname(entry.name).toLowerCase() === '.yml')) {
						// 处理YAML文件
						try {
							const content = await fs.readFile(fullPath, 'utf-8');
							const memory = yaml.load(content) as Memory | null | Memory[];
							if (memory) {
								if (Array.isArray(memory)) {
									for (const mem of memory) {
										this.memories.push(mem);
									}
								} else {
									this.memories.push(memory);
								}
							}
						} catch (e) {
							console.error(`Error parsing memory file ${entry.name}:`, e);
						}
					}
				}
			};
			
			// 从savePath开始递归读取
			await readFilesRecursively(this.savePath);
		} catch (error) {
			console.error('Error loading memories:', error);
		}
	}

	async saveMemory(memory: Memory) {
		// 确保记忆有创建时间
		if (!memory.createTime) {
			memory.createTime = new Date().toISOString();
		}

		this.memories.push(memory);

		const memoryString = yaml.dump(this.memories);
		const filePath = path.join(this.savePath, resolveCategory(memory.category));
		const directory = path.dirname(filePath);

		try {
			// 检查目录是否存在，不存在则创建
			await fs.mkdir(directory, { recursive: true });
			await fs.writeFile(filePath, memoryString);
		} catch (error) {
			console.error('Error saving memory:', error);
			throw error;
		}
	}

	async searchMemory(options: SearchOption) {
		//根据SearchOption进行内存搜索
		const results: Memory[] = [];

		for (const memory of this.memories) {
			let matchesCategory = true;
			let matchesKeywords = true;

			// 精确匹配 category
			if (options.category) {
				matchesCategory = memory.category.toLowerCase() === options.category.toLowerCase();
			}

			// 检查关键词是否有交集
			if (options.keywords && options.keywords.length > 0) {
				const memoryKeywordsLower = memory.keywords?.map(k => k.toLowerCase());
				const searchKeywordsLower = options.keywords.map(k => k.toLowerCase());
				matchesKeywords = searchKeywordsLower.some(keyword =>
					memoryKeywordsLower?.includes(keyword)
				);
			}

			// 所有条件都满足才添加到结果中
			if (matchesCategory && matchesKeywords) {
				results.push(memory);
			}
		}

		return results;
	}
}

// category，可能由/或\分割字符串，需要根据操作系统解析对应的分隔符，同时需要将名称统一为小写,最后也要消毒。
function resolveCategory(category: string) {
	// 统一分隔符为当前操作系统的路径分隔符
	const normalized = category.replace(/[/\\]/g, path.sep);

	// 转换为小写
	const lowercased = normalized.toLowerCase();

	// 分割路径，对每个部分进行消毒处理
	const parts = lowercased.split(path.sep);
	const sanitizedParts = parts.map(part => sanitizeFileName(part));

	// 重新组合路径，确保有.yaml扩展名
	let result = sanitizedParts.join(path.sep);
	if (!result.endsWith('.yaml') && !result.endsWith('.yml')) {
		result += '.yaml';
	}

	return result;
}
