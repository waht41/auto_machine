import { EventEmitter } from 'events';
import * as path from 'path';
import { OutputChannel } from './output-channel'; // 假设之前的 OutputChannel 模拟类存在

type StorageValue = string | number | boolean | null;

class MockMemento {
    private _storage: Map<string, StorageValue> = new Map();

    get<T extends StorageValue>(key: string, defaultValue?: T): T | undefined {
        return (this._storage.get(key) as T) ?? defaultValue;
    }

    update(key: string, value: StorageValue): Thenable<void> {
        this._storage.set(key, value);
        return Promise.resolve();
    }
}

export class MockExtensionContext {
    // ---------- Core Properties ----------
    extensionPath: string;
    subscriptions: { dispose(): any }[] = [];
    workspaceState: MockMemento = new MockMemento();
    globalState: MockMemento = new MockMemento();
    extensionUri: any; // 可转换为 URI 或 URL 类型
    globalStorageUri: any; // 可转换为 URI 或 URL 类型

    // ---------- Mock-Specific Additions ----------
    private _outputChannels: Map<string, OutputChannel> = new Map();
    private _emitter = new EventEmitter();

    constructor(options: {
        extensionPath?: string;
        storagePath?: string;
        environment?: 'node' | 'browser';
    } = {}) {
        this.extensionPath = options.extensionPath || process.cwd();
        this.extensionUri = this._createExtensionUri(
            options.environment || 'node'
        );
        this.globalStorageUri = {
            fsPath: options.storagePath || this.extensionPath
        }

        // 初始化清理钩子
        this.subscriptions.push({
            dispose: () => this._emitter.emit('dispose')
        });
    }

    // ---------- Core Methods ----------
    asAbsolutePath(relativePath: string): string {
        return path.resolve(this.extensionPath, relativePath);
    }

    // ---------- Mock-Specific Methods ----------
    createOutputChannel(name: string): OutputChannel {
        const channel = new OutputChannel(name);
        this._outputChannels.set(name, channel);
        return channel;
    }

    getOutputChannel(name: string): OutputChannel | undefined {
        return this._outputChannels.get(name);
    }

    // ---------- Test Utilities ----------
    simulateExtensionDeactivation(): void {
        this.subscriptions.forEach(sub => sub.dispose());
        this._emitter.emit('deactivate');
    }

    clearAllStorage(): void {
        this.workspaceState = new MockMemento();
        this.globalState = new MockMemento();
    }

    // ---------- Private Helpers ----------
    private _createExtensionUri(env: 'node' | 'browser'): any {
        if (env === 'browser') {
            return new URL(`file://${this.extensionPath}`);
        }
        return { fsPath: this.extensionPath };
    }
}

