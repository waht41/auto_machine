type Listener<T> = (e: T) => void;

interface Disposable {
    dispose(): void;
}

export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
}

export class EventEmitter<T> {
	private listeners: Listener<T>[] = [];

	// 暴露为事件属性用于订阅
	get event(): Event<T> {
		return (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => {
			const wrappedListener = thisArgs ? listener.bind(thisArgs) : listener;
			this.listeners.push(wrappedListener);

			const dispose = () => {
				const index = this.listeners.indexOf(wrappedListener);
				if (index !== -1) {
					this.listeners.splice(index, 1);
				}
			};

			const disposable = { dispose };

			if (disposables) {
				disposables.push(disposable);
			}

			return disposable;
		};
	}

	// 触发事件
	fire(event: T): void {
		for (const listener of [...this.listeners]) { // 创建副本避免迭代时修改
			listener(event);
		}
	}

	// 清空所有监听器
	dispose(): void {
		this.listeners = [];
	}
}
