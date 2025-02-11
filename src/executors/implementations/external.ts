import { ExternalCommand } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';

@RegisterExecutor('external')
export class ExternalCommandExecutor implements CommandExecutor{
    async execute(command: ExternalCommand, context: ExecutionContext) {
        console.log(`Executing: Open application "${command.request}"`);
        return '无权限';
    }
}