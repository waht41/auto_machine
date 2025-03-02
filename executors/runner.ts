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

        return await this.runMiddlewares(command, context);
    }

    // 更简洁的中间件执行方法（使用 reduce）
    private async runMiddlewares(command: Command, context: ExecutionContext): Promise<any> {
        // 如果没有中间件，直接执行命令
        if (this.middlewares.length === 0) {
            const executor = this.registry.getExecutor(command.type); //部分中间件会改变执行器
            if (!executor) {
                console.error(`No executor found for command type: ${command.type}`);
                return;
            }
            return await executor.execute(command, context);
        }

        // 定义最终执行器作为初始 next 函数
        let composedMiddleware = async (cmd: Command, ctx: ExecutionContext) => {
            const executor = this.registry.getExecutor(cmd.type);
            if (!executor) {
                console.error(`No executor found for command type: ${cmd.type}`);
                return;
            }
            return await executor.execute(cmd, ctx);
        };

        // 从右到左（从后向前）构建中间件链
        for (let i = this.middlewares.length - 1; i >= 0; i--) {
            const middleware = this.middlewares[i];
            const currentNext = composedMiddleware; // 保存当前的 next 引用
            
            // 创建新的组合中间件，包装当前中间件和下一个中间件
            composedMiddleware = async (cmd: Command, ctx: ExecutionContext) => {
                return await middleware(cmd, ctx, currentNext);
            };
        }

        // 执行组合后的中间件链
        return await composedMiddleware(command, context);
    }

    registerExecutor(type: string, executor: CommandExecutor) {
        this.registry.register(type, executor);
    }

    get executorNames(): string[] {
        return Array.from(this.registry.getAllExecutors().keys());
    }
}
