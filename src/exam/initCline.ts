import {ClineProvider} from "@core/webview/ClineProvider";
import * as vscode from "vscode"
import {ExtensionContext} from 'vscode'
import {MockExtensionContext, MockWebviewView} from "vscode";
const outputChannel = vscode.window.createOutputChannel("Roo-Code")
const context : vscode.ExtensionContext  = new MockExtensionContext();
const cp = new ClineProvider(context, outputChannel)
const webview = new MockWebviewView('mock')
cp.resolveWebviewView(webview)
cp.initClineWithTask('hello')
