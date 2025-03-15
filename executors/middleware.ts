import { Middleware } from './types';

/**
 * 日志中间件 - 记录命令执行的开始和结束
 */
export const loggerMiddleware: Middleware = async (command, context, next) => {
	console.log(`[开始执行] 命令类型: ${command.type}`);
	console.time(`命令执行时间: ${command.type}`);
    
	try {
		// 执行下一个中间件或最终的命令
		const result = await next(command, context);
        
		console.log(`[执行完成] 命令类型: ${command.type}`);
		console.timeEnd(`命令执行时间: ${command.type}`);
        
		return result;
	} catch (error) {
		console.error(`[执行失败] 命令类型: ${command.type}`, error);
		console.timeEnd(`命令执行时间: ${command.type}`);
		throw error;
	}
};

/**
 * 缓存中间件 - 可以缓存某些命令的执行结果
 */
export const cacheMiddleware = (options: { ttl?: number } = {}): Middleware => {
	const cache = new Map<string, { result: any; timestamp: number }>();
	const ttl = options.ttl || 60000; // 默认缓存1分钟
    
	return async (command, context, next) => {
		// 只对特定类型的命令进行缓存，或者根据命令内容创建缓存键
		if (!command.cacheable) {
			return next(command, context);
		}
        
		const cacheKey = `${command.type}-${JSON.stringify(command)}`;
		const cachedItem = cache.get(cacheKey);
        
		// 检查缓存是否有效
		if (cachedItem && Date.now() - cachedItem.timestamp < ttl) {
			console.log(`[缓存命中] 命令类型: ${command.type}`);
			return cachedItem.result;
		}
        
		// 执行命令并缓存结果
		const result = await next(command, context);
		cache.set(cacheKey, { result, timestamp: Date.now() });
        
		return result;
	};
};

/**
 * 重试中间件 - 在命令执行失败时自动重试
 */
export const retryMiddleware = (options: { maxRetries?: number; delay?: number } = {}): Middleware => {
	const maxRetries = options.maxRetries || 3;
	const delay = options.delay || 1000;
    
	return async (command, context, next) => {
		let lastError: Error | null = null;
        
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					console.log(`[重试] 命令类型: ${command.type}, 尝试次数: ${attempt}/${maxRetries}`);
					// 等待一段时间再重试
					await new Promise(resolve => setTimeout(resolve, delay));
				}
                
				return await next(command, context);
			} catch (error) {
				lastError = error as Error;
                
				// 如果是最后一次尝试，则抛出错误
				if (attempt === maxRetries) {
					console.error(`[重试失败] 命令类型: ${command.type}, 已达到最大重试次数: ${maxRetries}`);
					throw error;
				}
			}
		}
        
		// 这里不应该到达，但为了类型安全
		throw lastError;
	};
};

/**
 * 性能监控中间件 - 记录命令执行的性能指标
 */
export const performanceMiddleware: Middleware = async (command, context, next) => {
	const startTime = performance.now();
	const startMemory = process.memoryUsage().heapUsed;
    
	try {
		const result = await next(command, context);
        
		const endTime = performance.now();
		const endMemory = process.memoryUsage().heapUsed;
        
		console.log(`[性能] 命令类型: ${command.type}`);
		console.log(`  - 执行时间: ${(endTime - startTime).toFixed(2)}ms`);
		console.log(`  - 内存使用: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
        
		return result;
	} catch (error) {
		const endTime = performance.now();
		console.error(`[性能/错误] 命令类型: ${command.type}, 执行时间: ${(endTime - startTime).toFixed(2)}ms`);
		throw error;
	}
};

/**
 * 示例：如何使用这些中间件
 */
export const setupMiddlewareExample = (runner: any) => {
	// 按照添加顺序执行中间件
	runner
		.use(loggerMiddleware)
		.use(performanceMiddleware)
		.use(cacheMiddleware({ ttl: 30000 }))
		.use(retryMiddleware({ maxRetries: 2 }));
    
	return runner;
};
