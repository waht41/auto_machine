import File from '@operation/File';
import { CreateOptions, EditOptions, ListOptions, ReadOptions, SearchOptions } from '@operation/File/type';
import { CommandExecutor } from '@executors/types';
import yaml from 'js-yaml';

export class FileCommandExecutor implements CommandExecutor {
	async execute(command: FileCommand): Promise<string> {
		switch (command.cmd) {
			case 'read':
				return await File.read(command);
			case 'create':
				return await File.create(command);
			case 'list':
				return yaml.dump(await File.list(command));
			case 'search':
				return  yaml.dump(await File.search(command));
			case 'edit':
				return await File.edit(command);
			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}

export type FileCommand = {type: 'file'} & (
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
    } & EditOptions
    );