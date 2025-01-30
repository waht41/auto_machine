import * as vscode from 'vscode';

export class MockExtensionContext implements vscode.ExtensionContext {
    subscriptions: { dispose(): any }[] = [];
    workspaceState: vscode.Memento = new MockMemento();
    globalState: vscode.Memento = new MockMemento();
    extensionUri: vscode.Uri = vscode.Uri.file(__dirname);
    extensionPath: string = __dirname;
    environmentVariableCollection: vscode.EnvironmentVariableCollection = new MockEnvironmentVariableCollection();
    asAbsolutePath(relativePath: string): string {
        return require('path').join(this.extensionPath, relativePath);
    }
    storageUri: vscode.Uri | undefined = vscode.Uri.file(__dirname);
    globalStorageUri: vscode.Uri = vscode.Uri.file(__dirname);
    logUri: vscode.Uri = vscode.Uri.file(__dirname);
    extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
    secrets: vscode.SecretStorage = new MockSecretStorage();
}

class MockMemento implements vscode.Memento {
    private storage = new Map<string, any>();

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

class MockSecretStorage implements vscode.SecretStorage {
    private storage = new Map<string, string>();

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

class MockEnvironmentVariableCollection implements vscode.EnvironmentVariableCollection {
    private collection = new Map<string, vscode.EnvironmentVariableMutation>();

    persistent: boolean = true;

    replace(variable: string, value: string): void {
        this.collection.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Replace });
    }

    append(variable: string, value: string): void {
        this.collection.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Append });
    }

    prepend(variable: string, value: string): void {
        this.collection.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Prepend });
    }

    get(variable: string): vscode.EnvironmentVariableMutation | undefined {
        return this.collection.get(variable);
    }

    forEach(callback: (variable: string, mutator: vscode.EnvironmentVariableMutation, collection: vscode.EnvironmentVariableCollection) => any): void {
        this.collection.forEach((mutator, variable) => callback(variable, mutator, this));
    }

    delete(variable: string): void {
        this.collection.delete(variable);
    }

    clear(): void {
        this.collection.clear();
    }
}