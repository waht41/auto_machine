import { CommandExecutor } from '@executors/types';
import { IAskCommand, IInternalContext } from '@core/internal-implementation/type';

export class AskCommandExecutor implements CommandExecutor {
	async execute(command: IAskCommand, context: IInternalContext): Promise<any> {
		const cline = context.cline;
		const replacing = context.replacing;
		const messageId = replacing ? cline.getMessageId() : cline.getNewMessageId();
		console.log('[waht]','ask',command,replacing,messageId);
		await cline.askP({askType:'tool', text: JSON.stringify(command), partial: false,  messageId:messageId});
		return true;
	}
}

