import { CommandExecutor } from '@executors/types';
import { IBaseCommand, IInternalContext } from '@core/internal-implementation/type';

export class BaseCommandExecutor implements CommandExecutor {
	async execute(command: IBaseCommand, context: IInternalContext): Promise<boolean> {
		const cline = context.cline;
		await cline.sayP({sayType: 'tool', text: JSON.stringify(command), partial: false});
		return true;
	}
}

