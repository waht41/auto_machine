import { Command, Middleware } from '@executors/types';
import { IInternalContext } from '@core/internal-implementation/type';
import logger from '@/utils/logger';
import { parseXml } from '@/utils/xml';
import { CommandRunner } from '@executors/runner';
import { DIContainer } from '@core/services/di';
import { ApiConversationHistoryService } from '@core/services/ApiConversationHistoryService';
import { registerInternalImplementation } from '@core/internal-implementation';

export class ToolManager {
	private apiHistoryService!: ApiConversationHistoryService;
	private executor = new CommandRunner();
	private lengthLimit = 10_000;
	constructor(private di: DIContainer, middleWares: Middleware[] = []) {
		registerInternalImplementation(this.executor);
		for (const middleware of middleWares) {
			this.executor.use(middleware);
		}
	}
	async init(){
		this.apiHistoryService = await this.di.getByType(ApiConversationHistoryService);
	}
	async applyCommand(command: Command, context?: IInternalContext): Promise<string | null> {
		console.log('[waht] try apply tool', command);
		if (this.executor.executorNames.includes(command.type)) {
			const commandResult = await this.executor.runCommand(this.parseCommand(command), context) as string | null;
			if (typeof commandResult === 'string') {
				if (commandResult.length > this.lengthLimit){
					const omittedChars = commandResult.length - this.lengthLimit;
					return `${commandResult.substring(0, this.lengthLimit)}...\n\n(${omittedChars} characters omitted)`;
				}
			}
			return commandResult;
		}
		console.log('[waht]', 'no executor found for', command.type);
		return null;
	}

	private parseCommand(command: Command) {
		const parsedCommand: Command = { ...command };
		if (command.content && typeof command.content === 'string') {
			parsedCommand.content = this.replaceVariable(command.content as string);
			logger.debug('parseCommand content: ', parsedCommand);
		}
		return parsedCommand;
	}

	private replaceVariable(content: string): string {
		// 使用全局正则匹配所有 <var> 标签
		return content.replace(/<var\s+([^>]+?)\s*\/?>/g, (match, attributesStr) => {
			const attributes = parseXml(attributesStr);

			// 处理 historyId 属性（如果有）
			if ('historyId' in attributes) {
				logger.debug('Processing var tag with attributes:', attributes);
				return this.apiHistoryService.getHistoryTextWithId(Number(attributes.historyId))?.replace(this.apiHistoryService.metaRegex, '') ?? '';
			}

			// 警告未支持的属性
			const unsupportedAttrs = Object.keys(attributes).filter(attr => attr !== 'historyId');
			if (unsupportedAttrs.length > 0) {
				console.warn(`Unsupported attributes in <var> tag: ${unsupportedAttrs.join(', ')}`);
			}

			return ''; // 移除不支持的标签
		});
	}
}