import { CommandExecutor } from '@executors/types';
import { IApprovalCommand, IInternalContext } from '@core/internal-implementation/type';

export class ApprovalCommandExecutor implements CommandExecutor {
	async execute(command: IApprovalCommand, context: IInternalContext): Promise<any> {
		const cline = context.cline;
		return await cline.applyCommand(command.content, {...context, approval: true});
	}
}

