import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { IToolCategory, IToolItem } from './type';


/**
 * 解析YAML文件并转换为IToolCategory格式
 * @param filePath YAML文件路径
 * @param categoryId 工具类别ID
 * @param categoryLabel 工具类别标签
 * @returns IToolCategory对象
 */
export function parseYamlToToolCategory(
	filePath: string,
	categoryId: string,
	categoryLabel: string
): IToolCategory {
	try {
		// 读取YAML文件内容
		const fileContent = fs.readFileSync(filePath, 'utf8');

		// 解析YAML内容
		const yamlContent = yaml.load(fileContent) as Record<string, any>;

		// 提取文件顶部注释作为类别描述
		const firstLine = fileContent.trim().split('\n')[0];
		const categoryDescription = firstLine.startsWith('#')
			? firstLine.substring(1).trim()
			: `${categoryLabel}工具集合`;

		// 创建工具类别
		const toolCategory: IToolCategory = {
			id: categoryId,
			label: categoryLabel,
			description: categoryDescription,
			tools: []
		};

		// 遍历YAML中的每个命令，转换为IToolItem
		for (const [cmdName, cmdInfo] of Object.entries(yamlContent)) {
			// 跳过非对象类型的属性
			if (typeof cmdInfo !== 'object' || cmdInfo === null) {
				continue;
			}

			// 检查是否是嵌套工具类别（如navigation, interact等）
			if ((cmdInfo.common_params || Object.keys(cmdInfo).some(key => typeof cmdInfo[key] === 'object' && (cmdInfo[key].desc || cmdInfo[key].description))) && 
				Object.keys(cmdInfo).some(key => typeof cmdInfo[key] === 'object' && (cmdInfo[key].desc || cmdInfo[key].description))) {
				// 创建子类别
				const subCategory: IToolCategory = {
					id: `${categoryId}.${cmdName}`,
					label: cmdName,
					description: cmdInfo.description || `${cmdName}相关操作`,
					tools: []
				};

				// 遍历子命令
				for (const [subCmdName, subCmdInfo] of Object.entries(cmdInfo)) {
					// 跳过common_params和非对象类型
					if (subCmdName === 'common_params' || typeof subCmdInfo !== 'object' || subCmdInfo === null) {
						continue;
					}

					const toolItem: IToolItem = {
						id: `${categoryId}.${cmdName}.${subCmdName}`,
						label: subCmdName,
						// @ts-ignore
						description: subCmdInfo.desc || subCmdInfo.description || `${subCmdName}命令`
					};

					subCategory.tools.push(toolItem);
				}

				// 只有当子类别有工具时才添加
				if (subCategory.tools.length > 0) {
					toolCategory.tools.push(subCategory);
				}
			} else {
				// 创建普通工具项
				const toolItem: IToolItem = {
					id: `${categoryId}.${cmdName}`,
					label: cmdName,
					description: cmdInfo.description || `${cmdName}命令`
				};

				toolCategory.tools.push(toolItem);
			}
		}

		return toolCategory;
	} catch (error) {
		console.error(`解析YAML文件失败: ${filePath}`, error);
		// 返回一个空的工具类别
		return {
			id: categoryId,
			label: categoryLabel,
			description: '无法加载工具信息',
			tools: []
		};
	}
}

/**
 * 从YAML文件内容中提取工具ID
 * @param filePath YAML文件路径
 * @returns 工具ID
 */
export function extractToolIdFromYaml(filePath: string): string {
	try {
		// 读取YAML文件内容
		const fileContent = fs.readFileSync(filePath, 'utf8');
        
		// 查找example中的tool字段
		const toolMatch = fileContent.match(/tool:\s*([^\s\n]+)/);
		if (toolMatch && toolMatch[1]) {
			// 返回tool字段的值（区分大小写）
			return toolMatch[1].trim();
		}
        
		// 如果没有找到tool字段，返回文件名
		return path.basename(filePath, path.extname(filePath));
	} catch (error) {
		console.error(`提取工具ID失败: ${filePath}`, error);
		return path.basename(filePath, path.extname(filePath));
	}
}

/**
 * 解析指定的YAML文件并返回工具类别
 * @param filePaths YAML文件路径数组
 * @returns 工具类别数组
 */
export function parseToolsFromFiles(filePaths: string[]): IToolCategory[] {
	try {
		const toolCategories: IToolCategory[] = [];

		// 解析每个YAML文件
		for (const filePath of filePaths) {
			const fileName = path.basename(filePath, path.extname(filePath));
			// 从YAML文件中提取工具ID
			const toolId = extractToolIdFromYaml(filePath);

			const toolCategory = parseYamlToToolCategory(
				filePath,
				toolId,  // 使用提取的工具ID作为categoryId
				fileName // 使用文件名作为categoryLabel
			);

			toolCategories.push(toolCategory);
		}

		return toolCategories;
	} catch (error) {
		console.error('解析工具文件失败', error);
		return [];
	}
}

/**
 * 解析目录下的所有YAML文件并合并为一个工具集合
 * @param directoryPath YAML文件所在目录
 * @returns 工具类别数组
 */
export function parseToolsFromDirectory(directoryPath: string): IToolCategory[] {
	try {
		const toolCategories: IToolCategory[] = [];

		// 读取目录下的所有文件
		const files = fs.readdirSync(directoryPath);

		// 过滤出YAML文件
		const yamlFiles = files.filter(file =>
			file.endsWith('.yaml') || file.endsWith('.yml')
		);

		// 解析每个YAML文件
		for (const file of yamlFiles) {
			const filePath = path.join(directoryPath, file);
			const fileName = path.basename(file, path.extname(file));

			// 将文件名首字母大写作为类别标签
			const categoryLabel = fileName.charAt(0).toUpperCase() + fileName.slice(1);

			const toolCategory = parseYamlToToolCategory(
				filePath,
				fileName.toLowerCase(),
				categoryLabel
			);

			toolCategories.push(toolCategory);
		}

		return toolCategories;
	} catch (error) {
		console.error('解析工具目录失败', error);
		return [];
	}
}
