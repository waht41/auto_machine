// 监听器配置类型
export interface ListenerConfig<T, K extends keyof T, V extends keyof T> {
	target: V | V[];           // 目标派生状态，可以是单个或多个
	sources: K[] | K;          // 源状态（被监听的状态）
	compute: (current: T, prev: T | null | undefined) => any; // 计算函数
	extraUpdates?: (current: T, prev: T | null | undefined, newTargetValue: any) => Partial<T>; // 额外的更新
}

// 依赖图节点类型
interface DependencyNode<T> {
	key: keyof T;              // 状态键
	dependents: Set<keyof T>;  // 依赖此状态的其他状态
	configs: Array<{
		config: ListenerConfig<T, keyof T, keyof T>;
		targetKeys: Array<keyof T>;
	}>;
}

/**
 * 创建依赖图并设置监听器，用于管理派生状态
 * @param configs 监听器配置数组
 * @param store Zustand store 对象
 */
export function createListeners<T>(
	configs: ListenerConfig<T, keyof T, keyof T>[],
	store: any
) {
	// 构建依赖图
	const dependencyGraph = new Map<keyof T, DependencyNode<T>>();

	// 初始化依赖图
	configs.forEach(config => {
		const sources = Array.isArray(config.sources) ? config.sources : [config.sources];
		const targets = Array.isArray(config.target) ? config.target : [config.target];

		// 为每个源添加依赖关系
		sources.forEach(source => {
			if (!dependencyGraph.has(source)) {
				dependencyGraph.set(source, {
					key: source,
					dependents: new Set(),
					configs: []
				});
			}

			const node = dependencyGraph.get(source)!;

			// 添加依赖此源的目标
			targets.forEach(target => {
				node.dependents.add(target);
			});

			// 添加配置
			node.configs.push({
				config,
				targetKeys: targets
			});
		});
	});

	console.log('derived state', '依赖图构建完成',
		Object.fromEntries(
			Array.from(dependencyGraph.entries()).map(([key, node]) => [
				key,
				{
					dependents: Array.from(node.dependents),
					configsCount: node.configs.length
				}
			])
		)
	);

	// 为每个源状态设置监听器
	dependencyGraph.forEach((node, sourceKey) => {
		store.subscribe(
			(state: T) => state[sourceKey],
			(currentValue: unknown, prevValue: unknown) => {

				if (currentValue !== prevValue) {
					// 获取完整的当前状态
					const currentState = store.getState();

					// 收集所有需要更新的状态
					const updates: Partial<T> = {};

					// 处理依赖此源的所有配置
					node.configs.forEach(({ config, targetKeys }) => {
						// 获取所有源的当前值
						const sourcesValues: Partial<T> = {};
						const sources = Array.isArray(config.sources) ? config.sources : [config.sources];
						sources.forEach(source => {
							sourcesValues[source] = currentState[source];
						});

						// 计算新的目标值
						const computedValue = config.compute(sourcesValues as T, null);

						// 添加到更新对象
						if (Array.isArray(config.target)) {
							if (typeof computedValue === 'object' && computedValue !== null) {
								targetKeys.forEach(key => {
									if (key in computedValue) {
										updates[key] = computedValue[key as keyof typeof computedValue];
									}
								});
							} else {
								console.error('当 target 是数组时，compute 函数应返回一个对象');
							}
						} else {
							updates[config.target as keyof T] = computedValue;
						}

						// 处理额外的更新
						if (config.extraUpdates) {
							const extraUpdates = config.extraUpdates(sourcesValues as T, null, computedValue);
							Object.assign(updates, extraUpdates);
						}
					});

					// 更新状态
					if (Object.keys(updates).length > 0) {
						store.setState(updates);
					}
				}
			},
			{ fireImmediately: true }
		);
	});
}
