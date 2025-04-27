import { CommandExecutor } from '@executors/types';
import { AnalyzeCommand } from '@core/internal-implementation/type';
import { gatherHandler } from '@core/internal-implementation/handlers/analyzeHandler';
import { preview } from '@operation/Analyze';
import yaml from 'js-yaml';

/**
 * Analyze命令执行器
 * 负责处理与数据分析相关的命令
 */
export class AnalyzeCommandExecutor implements CommandExecutor {
	async execute(command: AnalyzeCommand): Promise<string> {
		switch (command.cmd) {
			case 'gather':
				return await gatherHandler(command);
			case 'preview':
				const res = await preview(command);
				if (res.success){
					// 使用安全的方式序列化数据
					return res.message + '\n' + yaml.dump(res.data);
				} else {
					return res.message ?? 'Error: no message returned';
				}
			default:
				throw new Error(`未知的Analyze命令: ${command}`);
		}
	}
}
