import {SecretStorage} from "vscode"; // Or 'vscode' if in a VS Code extension context
import {Event, Emitter} from "./events";

interface SecretStorageChangeEvent {
    key: string;
}

export class MockSecretStorage implements SecretStorage {
    private storage: Map<string, string> = new Map<string, string>();
    private _onDidChange: Emitter<SecretStorageChangeEvent> = new Emitter<SecretStorageChangeEvent>();
    public onDidChange: Event<SecretStorageChangeEvent> = this._onDidChange.event;

    get(key: string): Thenable<string | undefined> {
        return Promise.resolve(this.storage.get(key));
    }

    store(key: string, value: string): Thenable<void> {
        this.storage.set(key, value);
        this._onDidChange.fire({ key }); // Fire event when a secret is stored.
        return Promise.resolve();
    }

    delete(key: string): Thenable<void> {
        this.storage.delete(key);
        this._onDidChange.fire({ key }); // Fire event when a secret is deleted.
        return Promise.resolve();
    }
}