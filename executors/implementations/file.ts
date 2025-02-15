import { CommandExecutor } from "../command-executor";
import File from "@operation/File"
import { CreateOptions, EditOptions, ListOptions, ReadOptions, SearchOptions } from "@operation/File/type";
import { BaseCommand } from "@executors/base";
import { RegisterExecutor } from "@executors/registry";

@RegisterExecutor('file')
export class FileCommandExecutor implements CommandExecutor {
    execute(command: FileCommand, context: any): any {
        switch (command.cmd) {
            case 'read':
                return File.read(command);
            case 'create':
                return File.create(command);
            case 'list':
                return File.list(command);
            case 'search':
                return File.search(command);
            case 'edit':
                return File.edit(command);
            default:
                throw new Error(`Unknown action: ${command}`);
        }
    }
}

export type FileCommand = BaseCommand<'file'> & (
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