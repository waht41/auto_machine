import { OpenCommand } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';

@RegisterExecutor('open')
export class OpenCommandExecutor implements CommandExecutor {
    async execute(command: OpenCommand, context: ExecutionContext): Promise<void> {
        console.log(`Executing: Open application "${command.application}"`);
    }
}
