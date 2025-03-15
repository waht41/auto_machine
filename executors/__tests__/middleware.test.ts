import { CommandRunner } from '../runner';
import { Command, Middleware } from '../types';
import { loggerMiddleware, retryMiddleware, performanceMiddleware } from '../middleware';

// 模拟一个简单的命令执行器
class TestExecutor {
	async execute(command: Command, context: any) {
		return { success: true, data: command.data };
	}
}

// 模拟一个会失败的命令执行器
class FailingExecutor {
	private failCount = 0;
    
	async execute(command: Command, context: any) {
		this.failCount++;
        
		// 前两次失败，第三次成功
		if (this.failCount < 3) {
			throw new Error(`测试失败 #${this.failCount}`);
		}
        
		return { success: true, data: command.data, attempts: this.failCount };
	}
}

describe('中间件测试', () => {
	let runner: CommandRunner;
    
	beforeEach(() => {
		runner = new CommandRunner();
		// 注册测试执行器
		runner.registerExecutor('test', new TestExecutor());
		runner.registerExecutor('failing', new FailingExecutor());
	});
    
	test('基本命令执行，无中间件', async () => {
		const result = await runner.runCommand({ type: 'test', data: 'hello' }, {});
		expect(result).toEqual({ success: true, data: 'hello' });
	});
    
	test('使用日志中间件', async () => {
		// 监听控制台输出
		const consoleSpy = jest.spyOn(console, 'log');
        
		runner.use(loggerMiddleware);
        
		const result = await runner.runCommand({ type: 'test', data: 'with logger' }, {});
        
		expect(result).toEqual({ success: true, data: 'with logger' });
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[开始执行]'));
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[执行完成]'));
        
		consoleSpy.mockRestore();
	});
    
	test('使用重试中间件', async () => {
		runner.use(retryMiddleware({ maxRetries: 3, delay: 100 }));
        
		const result = await runner.runCommand({ type: 'failing', data: 'retry test' }, {});
        
		expect(result).toEqual({ 
			success: true, 
			data: 'retry test',
			attempts: 3 // 第三次尝试成功
		});
	});
    
	test('中间件链执行顺序', async () => {
		const executionOrder: string[] = [];
        
		// 创建测试中间件来跟踪执行顺序
		const createOrderMiddleware = (name: string): Middleware => {
			return async (command, context, next) => {
				executionOrder.push(`${name} 开始`);
				const result = await next(command, context);
				executionOrder.push(`${name} 结束`);
				return result;
			};
		};
        
		// 添加三个测试中间件
		runner
			.use(createOrderMiddleware('中间件1'))
			.use(createOrderMiddleware('中间件2'))
			.use(createOrderMiddleware('中间件3'));
        
		await runner.runCommand({ type: 'test', data: 'order test' }, {});
        
		// 验证执行顺序是否正确（洋葱模型）
		expect(executionOrder).toEqual([
			'中间件1 开始',
			'中间件2 开始',
			'中间件3 开始',
			'中间件3 结束',
			'中间件2 结束',
			'中间件1 结束'
		]);
	});
    
	test('组合多个中间件', async () => {
		const consoleSpy = jest.spyOn(console, 'log');
        
		runner
			.use(loggerMiddleware)
			.use(performanceMiddleware)
			.use(retryMiddleware({ maxRetries: 2, delay: 100 }));
        
		const result = await runner.runCommand({ type: 'failing', data: 'combined test' }, {});
        
		expect(result).toEqual({ 
			success: true, 
			data: 'combined test',
			attempts: 3
		});
        
		// 验证日志中间件和性能中间件都被执行
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[开始执行]'));
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[性能]'));
        
		consoleSpy.mockRestore();
	});
});
