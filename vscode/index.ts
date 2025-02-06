import {OutputChannel} from "./output-channel";
import {MockFileSystemWatcher} from "./fileSystemWatcher";
import MockUri from "./Uri";
import {BaseMemento} from "./storage/memo";
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import path from 'path';
import {Disposable} from "vscode";


export const window = {
    createOutputChannel: (name: string) => new OutputChannel(name),
    createTextEditorDecorationType: ({}) => ({}),
    tabGroups: {
        all: []
    }
}


export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

export const workspace = {
    workspaceFolders: [],
    createFileSystemWatcher: () => new MockFileSystemWatcher(),
    onDidSaveTextDocument: () => {
    },

    // 使用 BaseMemento 存储配置
    _configMemento: new BaseMemento('vscode_workspace_config'),
    getConfiguration: function (section: string, resource?: any, scopeUri?: any) {
        return {
            get: <T>(key: string): T | undefined => {
                const fullKey = `${section}.${key}`;
                return this._configMemento.get(fullKey);
            },
            update: async (key: string, value: any, target?: ConfigurationTarget | boolean) => {
                const fullKey = `${section}.${key}`;
                await this._configMemento.update(fullKey, value);
                return Promise.resolve();
            }
        };
    },
    // 设置模拟配置值的方法
    setConfiguration: function (section: string, key: string, value: any) {
        const fullKey = `${section}.${key}`;
        this._configMemento.update(fullKey, value);
    },
    // 重置模拟配置
    resetConfiguration: function () {
        this._configMemento.clear();
    },
    onDidChangeConfiguration: function (listener: (e) => any, thisArgs?: any, disposables?: Disposable[]) {
        console.log('onDidChangeConfiguration in the mock vscode','args,',thisArgs)
    }
}

export const Uri = MockUri

export enum ExtensionMode {
    /**
     * The extension is installed normally (for example, from the marketplace
     * or VSIX) in the editor.
     */
    Production = 1,

    /**
     * The extension is running from an `--extensionDevelopmentPath` provided
     * when launching the editor.
     */
    Development = 2,

    /**
     * The extension is running from an `--extensionTestsPath` and
     * the extension host is running unit tests.
     */
    Test = 3,
}

export {MockExtensionContext} from "./context";

export const env = {language: 'zh-CN'}

export {MockWebviewView} from "./mock-webview";

export {EventEmitter} from "./events";