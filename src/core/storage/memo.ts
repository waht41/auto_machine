import fs from 'fs';
import cloneDeep from 'clone-deep';

export class Memento {
	private cache: Map<string, unknown>;
	private dirty: boolean = false;
	private writePromise: Promise<void> = Promise.resolve(); // 写入锁

	constructor(private storagePath: string) {
		this.cache = new Map<string, unknown>();

		// Initialize cache from file
		if (fs.existsSync(this.storagePath)) {
			try {
				const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
				this.cache = new Map(Object.entries(data));
			} catch (error) {
				this.cache = new Map();
			}
		}
	}

	private async flushIfNeeded(): Promise<void> {
		if (this.dirty) {
			// 将当前操作加入写入队列
			this.writePromise = this.writePromise.then(async () => {
				try {
					// 再次检查dirty标志，因为可能在队列中等待时已被其他操作处理
					if (this.dirty) {
						this.dirty = false;
						const data = Object.fromEntries(this.cache);
						await fs.promises.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
					}
				} catch (error) {
					console.error('Failed to write to storage file:', error);
					// 即使出错也要重置Promise链，避免阻塞后续操作
				}
			});
			return this.writePromise;
		}
		return Promise.resolve();
	}

	get(key: string, defaultValue?: unknown) {
		return this.cache.has(key) ? cloneDeep(this.cache.get(key)) : defaultValue;
	}

	update(key: string, value: unknown): Thenable<void> {
		const currentValue = this.cache.get(key);
		if (currentValue !== value) {
			this.cache.set(key, value);
			this.dirty = true;
			return this.flushIfNeeded();
		}
		return Promise.resolve();
	}

	keys(): readonly string[] {
		return Array.from(this.cache.keys());
	}

	clear(): Thenable<void> {
		this.cache.clear();
		this.dirty = true;
		return this.flushIfNeeded();
	}

	remove(key: string): Thenable<void> {
		this.cache.delete(key);
		this.dirty = true;
		return this.flushIfNeeded();
	}

	getAll(): unknown {
		return Object.fromEntries(this.cache);
	}
}
