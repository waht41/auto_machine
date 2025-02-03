import {OutputChannel} from "./output-channel";
import {MockFileSystemWatcher} from "./fileSystemWatcher";
import MockUri from "./Uri";

import {fileURLToPath} from 'url';
import {dirname} from 'path';
import path from 'path';
import {Disposable} from "vscode";

// Get file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Export the root directory
export const ROOT_DIR = path.resolve(__dirname, '../..');

// Create type declarations
declare global {
    var __filename: string;
    var __dirname: string;
}

// Assign to global scope
global.__filename = __filename;
global.__dirname = __dirname;

export const window = {
    createOutputChannel: (name: string) => new OutputChannel(name),
    createTextEditorDecorationType: ({}) => ({}),
    tabGroups: {
        all: []
    }
}


export const workspace = {
    workspaceFolders: [],
    createFileSystemWatcher: () => new MockFileSystemWatcher(),
    onDidSaveTextDocument: () => {
    },

    // 新增 mock 配置支持
    _config: {} as Record<string, any>, // 存储配置的模拟对象
    getConfiguration: function (section: string) {
        return {
            get: <T>(key: string): T | undefined => {
                // 返回对应 section 和 key 的配置值
                return this._config[section]?.[key];
            }
        };
    },
    // 设置模拟配置值的方法
    setConfiguration: function (section: string, key: string, value: any) {
        if (!this._config[section]) {
            this._config[section] = {};
        }
        this._config[section][key] = value;
    },
    // 重置模拟配置
    resetConfiguration: function () {
        this._config = {};
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