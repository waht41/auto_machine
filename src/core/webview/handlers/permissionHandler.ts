import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';

export const permissionHandlers = {
	'userApproval': handleUserApproval,
	'setAllowedTools': handleSetAllowedTools,
	'allowedCommands': handleAllowedCommands,
	'toggleToolAlwaysAllow': handleToggleToolAlwaysAllow,
};

/**
 * 处理用户审批
 */
export async function handleUserApproval(instance: ClineProvider, message: WebviewMessage) {
	instance.cline?.receiveApproval(message.payload);
}

/**
 * 设置允许的工具
 */
export async function handleSetAllowedTools(instance: ClineProvider, message: WebviewMessage) {
	await instance.setAllowedTools(message.toolId!);
}

/**
 * 设置允许的命令
 */
export async function handleAllowedCommands(instance: ClineProvider, message: WebviewMessage) {
	await instance.config.set('allowedCommands', message.commands);
	// Also update workspace settings
	await vscode.workspace
		.getConfiguration('roo-cline')
		.update('allowedCommands', message.commands, vscode.ConfigurationTarget.Global);
}

/**
 * 切换工具的自动允许状态
 */
export async function handleToggleToolAlwaysAllow(instance: ClineProvider, message: WebviewMessage) {
	try {
		await instance.mcpHub?.toggleToolAlwaysAllow(
            message.serverName!,
            message.toolName!,
            message.alwaysAllow!,
		);
	} catch (error) {
		console.error(`Failed to toggle auto-approve for tool ${message.toolName}:`, error);
	}
}
