import { CommandExecutor } from '@executors/types';
import { GraphCommand, IInternalContext } from '@core/internal-implementation/type';

export class GraphCommandExecutor implements CommandExecutor {
	async execute(command: GraphCommand, context: IInternalContext): Promise<string | null> {
		const cline = context.cline;
		await cline.sayP({sayType:'tool',text:JSON.stringify(command)});
		return null;
	}
}