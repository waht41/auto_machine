import { Command } from './types';
import { CommandExecutor } from './command-executor';
import { ExecutorRegistry } from './registry';
import './implementations'; // Import implementations to trigger decorators

export class CommandRunner {
    private registry: ExecutorRegistry;

    constructor() {
        this.registry = ExecutorRegistry.getInstance();
    }

    async runCommand(command: Command, context: any): Promise<any> {
        const executor = this.registry.getExecutor(command.type);
        
        if (!executor) {
            console.error(`No executor found for command type: ${command.type}`);
            return;
        }

        return await executor.execute(command, context);
    }

    registerExecutor(type: string, executor: CommandExecutor) {
        this.registry.register(type, executor);
    }

    get executorNames(): string[] {
        return Array.from(this.registry.getAllExecutors().keys());
    }
}
