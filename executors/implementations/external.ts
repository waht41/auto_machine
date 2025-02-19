import { CommandExecutor } from '../command-executor';
import { RegisterExecutor } from '../registry';
import file from "fs/promises";
import path from "path";

@RegisterExecutor('external')
export class ExternalCommandExecutor implements CommandExecutor{
    async execute(command: ExternalCommand, context: any) {
        console.log(`Executing: Open External "${command.request}"`);
        try {
            return await file.readFile(path.join('.','external-prompt', `${command.request}.yaml`), 'utf8');
        } catch (e) {
            const msg = `Failed to open External "${command.request}"`;
            console.error(msg);
            return msg;
        }

    }
}

export type ExternalCommand = {
    type: 'external';
    request: string;
}