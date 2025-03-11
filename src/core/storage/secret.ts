import { Memento } from "@core/storage/memo";
import { ISecret } from "@core/storage/type";
import { SecretKey } from "@core/webview/type";

export class SecretStorage {
  private memento: Memento
  constructor(secretPath: string) {
    console.log('[waht]','secretPath',secretPath)
    this.memento = new Memento(secretPath)
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.memento.get(key)
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.memento.update(key, value)
  }

  async remove(key: SecretKey): Promise<void> {
    return this.memento.remove(key);
  }

  async getAll(): Promise<ISecret> {
    return this.memento.getAll()
  }

  async setAll(secrets: ISecret): Promise<void> {
    for (const key of Object.keys(secrets) as Array<keyof ISecret>) {
      await this.set(key, secrets[key])
    }
  }

  keys(): readonly string[] {
    return this.memento.keys()
  }
}
