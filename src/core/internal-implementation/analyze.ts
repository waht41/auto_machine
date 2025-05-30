import { CommandExecutor } from '@executors/types';
import { AnalyzeCommand } from '@core/internal-implementation/type';
import { gatherHandler, previewHandler } from '@core/internal-implementation/handlers/analyzeHandler';

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
				return await previewHandler(command);
			default:
				throw new Error(`未知的Analyze命令: ${command}`);
		}
	}
}
