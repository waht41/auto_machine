import File from '@operation/File';
import {
	CreateOptions,
	DownloadOptions,
	EditOptions,
	ListOptions,
	ReadOptions,
	SearchOptions
} from '@operation/File/type';
import { CommandExecutor } from '@executors/types';
import yaml from 'js-yaml';
import { IInternalContext } from '@core/internal-implementation/type';

export class FileCommandExecutor implements CommandExecutor {
	async execute(command: FileCommand, context: IInternalContext): Promise<string> {
		const { cline } = context;
		switch (command.cmd) {
			case 'read':
				return await File.read(command);
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

			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}

export type FileCommand = { type: 'file' } & (
	{
		cmd: 'read';
	} & ReadOptions |
	{
		cmd: 'create';
	} & CreateOptions |
	{
		cmd: 'list';
	} & ListOptions |
	{
		cmd: 'search';
	} & SearchOptions |
	{
		cmd: 'edit';
	} & EditOptions |
	{
		cmd: 'download';
	} & DownloadOptions
	);