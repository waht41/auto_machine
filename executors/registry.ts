import { CommandType } from './types';
import { CommandExecutor, SafeCommandExecutor } from './command-executor';

export class ExecutorRegistry {
    private static instance: ExecutorRegistry;
    private executors = new Map<string, CommandExecutor>();

    private constructor() {}

    static getInstance(): ExecutorRegistry {
        if (!ExecutorRegistry.instance) {
            ExecutorRegistry.instance = new ExecutorRegistry();
        }
        return ExecutorRegistry.instance;
    }

    register(type: CommandType, executor: CommandExecutor): void {
        const safeExecutor = executor instanceof SafeCommandExecutor
            ? executor
            : new SafeCommandExecutor(executor);
        this.executors.set(type, safeExecutor);
    }

    getExecutor(type: string): CommandExecutor | undefined {
        return this.executors.get(type);
    }

    getAllExecutors(): Map<string, CommandExecutor> {
        return new Map(this.executors);
    }
}

// 装饰器工厂
export function RegisterExecutor(type: CommandType) {
    return function(constructor: new () => CommandExecutor) {
        const registry = ExecutorRegistry.getInstance();
        registry.register(type, new constructor());
    };
}
