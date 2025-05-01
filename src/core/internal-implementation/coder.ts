import { CommandExecutor } from '@executors/types';
import { CoderCommand, IInternalContext } from '@core/internal-implementation/type';
import { handleCmdCommand, handleNodeCommand } from '@core/internal-implementation/handlers/coderHandler';

export class CoderCommandExecutor implements CommandExecutor {
	async execute(command: CoderCommand, context: IInternalContext): Promise<string> {
		switch (command.cmd) {
			case 'cmd':
				return await handleCmdCommand(command, context);
			case 'node':
				return await handleNodeCommand(command, context);
			default:
				throw new Error(`Unknown Coder command: ${(command as any).cmd}`);
		}
	}
}