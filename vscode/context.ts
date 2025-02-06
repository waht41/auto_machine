import * as vscode from 'vscode';
import {BaseMemento} from "./storage/memo";
import {EnvironmentVariableMutator, GlobalEnvironmentVariableCollection, MarkdownString} from "vscode";
import {undefined} from "zod";
import {MockSecretStorage} from "./storage/secret";
import {GlobalState} from "./storage/global-state";

export class MockExtensionContext implements vscode.ExtensionContext {
    subscriptions: { dispose(): any }[] = [];
    workspaceState: vscode.Memento = new BaseMemento();
    globalState: GlobalState = new GlobalState();
    extensionUri: vscode.Uri = vscode.Uri.file(__dirname);
    extensionPath: string = __dirname;
    environmentVariableCollection: GlobalEnvironmentVariableCollection = new MockEnvironmentVariableCollection();
    asAbsolutePath(relativePath: string): string {
        return require('path').join(this.extensionPath, relativePath);
    }
    storageUri: vscode.Uri | undefined = vscode.Uri.file(__dirname);
    globalStorageUri: vscode.Uri = vscode.Uri.file(__dirname);
    logUri: vscode.Uri = vscode.Uri.file(__dirname);
    extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
    secrets: vscode.SecretStorage = new MockSecretStorage();
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

    description: string | MarkdownString | undefined;

    [Symbol.iterator](): Iterator<[variable: string, mutator: EnvironmentVariableMutator], any, any> {
        return undefined;
    }
}