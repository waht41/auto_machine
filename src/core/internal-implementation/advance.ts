import { CommandExecutor } from '@executors/types';
import { IInternalContext } from '@core/internal-implementation/type';
import { Memory, SearchOption } from '@core/services/type';
import { MemoryService } from '@core/services/memoryService';
import yaml from 'js-yaml';
import { ApiConversationHistoryService } from '@core/services/ApiConversationHistoryService';

export class AdvanceExecutor implements CommandExecutor {
	async execute(command: AdvanceCommand, context: IInternalContext): Promise<string|null> {
		const di = context.di;
		switch (command.cmd){
			case 'memory':
				return memoryHandler(command, context);
			case 'compress':
				const apiHistoryService = await di.getByType(ApiConversationHistoryService);
				await  apiHistoryService.deleteMessageWithId(command.history_id);
				return 'success. \n compress summary:\n' + command.summary;
		}
		return null;
	}
}

async function memoryHandler(command: MemoryCommand, context: IInternalContext): Promise<any> {
	const memoryService = await context.di.getByType(MemoryService);
	switch (command.action){
		case 'add':
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { type, cmd, ...memoryData } = command;
			await memoryService.saveMemory(memoryData);
			return 'memory:\n' + yaml.dump(memoryData) +'\b has been added';
		case 'search':
			const result = await memoryService.searchMemory(command);
			return 'memory search result:\n' + yaml.dump(result);
	}
}

type MemoryCommand = {
	type:'advance',
	cmd: 'memory',
} & ({
	action:'add',
} & Memory  | {action:'search'}& SearchOption)

type CompressCommand = {
	type:'compress',
	cmd: 'compress',
	history_id: number[],
	summary: string;
}
type AdvanceCommand = MemoryCommand | CompressCommand;
