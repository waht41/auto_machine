import { Memento } from '@core/storage/memo';
import { ISecret } from '@core/storage/type';
import { SecretKey } from '@core/webview/type';

export class SecretStorage {
	private memento: Memento;
	constructor(secretPath: string) {
		this.memento = new Memento(secretPath);
	}

	async get<T extends keyof ISecret>(key: T): Promise<ISecret[T] | undefined> {
		return this.memento.get(key) as ISecret[T] | undefined;
	}

	async set<T extends keyof ISecret>(key: T, value: ISecret[T]): Promise<void> {
		return this.memento.update(key, value);
	}

	async remove(key: SecretKey): Promise<void> {
		return this.memento.remove(key);
	}

	async getAll(): Promise<ISecret> {
		return this.memento.getAll() as ISecret;
	}

	async setAll(secrets: ISecret): Promise<void> {
		for (const key of Object.keys(secrets) as Array<keyof ISecret>) {
			await this.set(key, secrets[key]);
		}
	}

	keys(): readonly string[] {
		return this.memento.keys();
	}
}
