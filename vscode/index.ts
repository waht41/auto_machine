import {OutputChannel} from "./output-channel";
import {MockFileSystemWatcher} from "./fileSystemWatcher";
import MockUri from "./Uri";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

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
    createTextEditorDecorationType: ({}) => ({})
}


export const workspace = {
    workspaceFolders: [],
    createFileSystemWatcher: () => new MockFileSystemWatcher(),
    onDidSaveTextDocument: () => {},
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

export { MockExtensionContext } from "./context";