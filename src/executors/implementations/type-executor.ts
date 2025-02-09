import { TypeCommand } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';

@RegisterExecutor('type')
export class TypeCommandExecutor implements CommandExecutor {
    async execute(command: TypeCommand, context: ExecutionContext): Promise<void> {
        console.log(`Executing: Type text "${command.content}"`);
    }
}
