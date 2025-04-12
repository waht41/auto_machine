import { CommandExecutor } from '@executors/types';
import { IBaseCommand, IInternalContext } from '@core/internal-implementation/type';
import { handlePlanCommand } from '@core/internal-implementation/handlers/planHandler';
import { UIMessageService } from '@core/services/UIMessageService';

export class BaseCommandExecutor implements CommandExecutor {
	async execute(command: IBaseCommand, context: IInternalContext): Promise<null | string> {
		const cline = context.cline;
		const di = context.di;
		switch (command.cmd){
			case 'plan':
				return handlePlanCommand(command, context);
			case 'complete_parallel_node':
				const uiMessageService = await di.getByType(UIMessageService);
				const parentId = uiMessageService.getState('parentId');
				if (!parentId){
					return null;
				}
				await cline.postInterMessage({sourceId: cline.taskId, targetId: parentId, message: command.message, sourceStatus: command.status});
				return null;
		}
		await cline.sayP({sayType: 'tool', text: JSON.stringify(command), partial: false});
		return null;
	}
}

