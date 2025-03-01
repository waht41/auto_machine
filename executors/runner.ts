import { Command, CommandExecutor, ExecutionContext, Middleware } from './types';
import { ExecutorRegistry } from './registry';

export class CommandRunner {
    private registry: ExecutorRegistry;
    private middlewares: Middleware[] = [];

    constructor() {
        this.registry = ExecutorRegistry.getInstance();
    }

    // 添加中间件
    use(middleware: Middleware): CommandRunner {
        this.middlewares.push(middleware);
        return this;
    }

    async runCommand(command: Command, context: ExecutionContext): Promise<any> {
        const executor = this.registry.getExecutor(command.type);

        if (!executor) {
            console.error(`No executor found for command type: ${command.type}`);
            return;
        }

        // 如果没有中间件，直接执行命令
        if (this.middlewares.length === 0) {
            return await executor.execute(command, context);
        }

        // 创建中间件执行链
        const middlewareChain = this.createMiddlewareChain(executor, 0);
        return await middlewareChain(command, context);
    }

    // 创建中间件执行链
    private createMiddlewareChain(executor: CommandExecutor, index: number): (command: Command, context: ExecutionContext) => Promise<any> {
        if (index >= this.middlewares.length) {
            // 最后一个中间件执行完后，执行实际的命令
            return async (command: Command, context: ExecutionContext) => {
                return await executor.execute(command, context);
            };
        }

        const currentMiddleware = this.middlewares[index];
        const nextMiddleware = this.createMiddlewareChain(executor, index + 1);

        return async (command: Command, context: ExecutionContext) => {
            return await currentMiddleware(command, context, nextMiddleware);
        };
    }

    registerExecutor(type: string, executor: CommandExecutor) {
        this.registry.register(type, executor);
    }

    get executorNames(): string[] {
        return Array.from(this.registry.getAllExecutors().keys());
    }
}
