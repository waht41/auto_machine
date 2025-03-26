import { CommandExecutor } from '@executors/types';
import { IBaseCommand, IInternalContext } from '@core/internal-implementation/type';
import { handlePlanCommand } from '@core/internal-implementation/handlers/planHandler';

export class BaseCommandExecutor implements CommandExecutor {
	async execute(command: IBaseCommand, context: IInternalContext): Promise<null | string> {
		const cline = context.cline;
		switch (command.cmd){
			case 'plan':
				return handlePlanCommand(command, context);
		}
		await cline.sayP({sayType: 'tool', text: JSON.stringify(command), partial: false});
		return null;
	}
}

