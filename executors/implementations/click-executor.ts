import { ClickCommand } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';

@RegisterExecutor('click')
export class ClickCommandExecutor implements CommandExecutor {
    async execute(command: ClickCommand, context: ExecutionContext): Promise<void> {
        const { target, context: targetContext } = command;
        if (targetContext) {
            console.log(`Executing: Click "${target}" in window "${targetContext}"`);
        } else {
            console.log(`Executing: Click "${target}"`);
        }
    }
}
