import File from '@operation/File';
import { CommandExecutor } from '@executors/types';
import yaml from 'js-yaml';
import { FileCommand, IInternalContext } from '@core/internal-implementation/type';
import { type Cline } from '@core/Cline';

export class FileCommandExecutor implements CommandExecutor {
	async execute(command: FileCommand, context: IInternalContext): Promise<string> {
		const { cline } = context;
		switch (command.cmd) {
			case 'read':
				const content = await File.read(command);
				await showInFolder(command.path, cline);
				return content;
			case 'create':
				return await File.create(command);
			case 'list':
				return yaml.dump(await File.list(command));
			case 'search':
				return yaml.dump(await File.search(command));
			case 'edit':
				return await File.edit(command);
			case 'download':
				let partial = true;
				const messageId = cline.getNewMessageId();
				for await (const progress of File.download(command)) {
					if (progress.status === 'completed'){
						partial = false;
					}
					await cline?.sayP({ sayType:'tool',text: JSON.stringify({...command,...progress}), partial, messageId });
				}
				return 'Download completed';
			case 'rename':
				const newPath = await File.rename(command);
				await showInFolder(newPath, cline);
				return `Rename from ${command.path} to ${command.name} successfully.`;


			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}

async function showInFolder(path: string, cline: Cline) {
	await cline.sayP({ sayType:'tool',text: JSON.stringify({type: 'base',cmd:'showInFolder', path })});
}