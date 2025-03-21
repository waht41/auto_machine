import * as vscode from 'vscode';
import {BaseMemento} from './storage/memo';
import {MockSecretStorage} from './storage/secret';
import {GlobalState} from './storage/global-state';
import path from 'path';

export class MockExtensionContext implements vscode.ExtensionContext {
	subscriptions: { dispose(): any }[] = [];
	workspaceState: vscode.Memento = new BaseMemento();
	globalState: GlobalState = new GlobalState();
	extensionUri: vscode.Uri = vscode.Uri.file('.');
	extensionPath: string = './extension';
	asAbsolutePath(relativePath: string): string {
		return path.join(this.extensionPath, relativePath);
	}
	storageUri: vscode.Uri | undefined = vscode.Uri.file('.');
	globalStorageUri: vscode.Uri = vscode.Uri.file('.');
	logUri: vscode.Uri = vscode.Uri.file('.');
	extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
	secrets: vscode.SecretStorage = new MockSecretStorage();
}
