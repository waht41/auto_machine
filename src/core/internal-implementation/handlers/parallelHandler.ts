import { PostService } from '@core/services/postService';
import { ClineIdentifier, ParallelProp } from '@/shared/type';
import { IInternalContext, ParallelCommand } from '@core/internal-implementation/type';
import { InterClineMessage } from '@core/services/type';
import pWaitFor from 'p-wait-for';

export async function handleParallelCommand(command: ParallelCommand, context: IInternalContext){
	const di = context.di;
	const cline = context.cline;
	const postService = await di.getByType(PostService);
	const clines: ClineIdentifier[] = [];
	const parallelProp: ParallelProp = {
		clines: clines
	};
	for (const subTask of command.sub_tasks){
		const task = subTask + '\n and use cmd complete_parallel_node to tell parent node when finished task';
		const newId = await postService.createCline({task, parentId: cline.taskId});
		clines.push({
			task,
			id: newId,
			status: 'running'
		});
	}
	const messageId = context.replacing ? cline.getMessageId() : cline.getNewMessageId();
	await cline.sayP({sayType:'tool',text:JSON.stringify({...command, ...parallelProp}), partial: true, messageId});

	let remainingNumber = clines.length;

	const handleInterMessage = async (message: InterClineMessage)=> {
		const subCline = clines.find(item => item.id === message.sourceId);
		if (!subCline) {
			return;
		}
		if (subCline.status === 'running' && message.sourceStatus !== 'running') {
			remainingNumber--;
		}
		if (subCline.status !== 'running' && message.sourceStatus === 'running') {
			remainingNumber++;
		}

		subCline.status = message.sourceStatus;
		await cline.sayP({sayType:'tool',text:JSON.stringify({...command, ...parallelProp}), partial: true, messageId});
	};

	cline.clineBus.on('interMessage', handleInterMessage);

	await pWaitFor(()=> remainingNumber === 0);
	return null;
}

