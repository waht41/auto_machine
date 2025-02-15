import { MacroDefinition } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';
import { CommandRunner } from '../runner';

@RegisterExecutor('define')
export class MacroCommandExecutor implements CommandExecutor {
    async execute(command: MacroDefinition, context: ExecutionContext): Promise<void> {
        console.log(`Registering macro "${command.name}" with ${command.commands.length} commands`);
        context.macros.set(command.name, command.commands);
    }
}
