import { Command } from './types';
import { ExecutionContext } from './command-executor';
import { ExecutorRegistry } from './registry';
// Import implementations to trigger decorators
import './implementations';

export class CommandRunner {
    private registry: ExecutorRegistry;
    private context: ExecutionContext;

    constructor() {
        this.registry = ExecutorRegistry.getInstance();
        this.context = {
            variables: new Map(),
            macros: new Map()
        };
    }

    async runCommand(command: Command, context: any): Promise<any> {
        const executor = this.registry.getExecutor(command.type);
        
        if (!executor) {
            console.error(`No executor found for command type: ${command.type}`);
            return;
        }

        return await executor.execute(command, context);
    }

    // 获取已定义的宏
    getMacro(name: string): Command[] | undefined {
        return this.context.macros.get(name);
    }

    // 设置变量
    setVariable(name: string, value: any): void {
        this.context.variables.set(name, value);
    }

    // 获取变量
    getVariable(name: string): any {
        return this.context.variables.get(name);
    }

    get types(): string[] {
        return Array.from(this.registry.getAllExecutors().keys());
    }
}
