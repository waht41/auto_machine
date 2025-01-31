import vscode from "vscode";

export class MockMemento implements vscode.Memento {
    private storage = new Map<string, any>();
    constructor() {
        this.storage.set('apiProvider','deepseek')
        this.storage.set('apiModelId','deepseek-reasoner')
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue?: any) {
        return this.storage.has(key) ? this.storage.get(key) : defaultValue;
    }

    update(key: string, value: any): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }
}