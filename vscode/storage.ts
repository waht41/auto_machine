import vscode from "vscode";

export class MockSecretStorage implements vscode.SecretStorage {
    private storage = new Map<string, string>();

    constructor() {
        this.storage.set('deepSeekApiKey','sk-6eea01cbe45e45948123560fcce2035f')
    }
    get(key: string): Thenable<string | undefined> {
        return Promise.resolve(this.storage.get(key));
    }

    store(key: string, value: string): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }

    delete(key: string): Thenable<void> {
        this.storage.delete(key);
        return Promise.resolve();
    }
}