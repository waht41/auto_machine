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

    register(type: string, executor: CommandExecutor): void {
        if (this.executors.has(type)) {
            console.error(`Executor already registered for type: ${type}`);
        }
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
export function RegisterExecutor(type: string) {
    return function(constructor: new () => CommandExecutor) {
        const registry = ExecutorRegistry.getInstance();
        registry.register(type, new constructor());
    };
}
