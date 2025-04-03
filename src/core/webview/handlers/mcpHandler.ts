import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';

export const mcpHandlers = {
	'mcpEnabled': handleMcpEnabled,
	'openMcpSettings': handleOpenMcpSettings,
	'restartMcpServer': handleRestartMcpServer,
	'toggleMcpServer': handleToggleMcpServer,
	'updateMcpTimeout': handleUpdateMcpTimeout,
	'alwaysAllowMcp': handleAlwaysAllowMcp,
};

/**
 * 处理 MCP 启用/禁用状态更新
 */
export async function handleMcpEnabled(instance: ClineProvider, message: WebviewMessage) {
	const mcpEnabled = message.bool ?? true;
	await instance.updateConfig('mcpEnabled', mcpEnabled);
	await instance.postStateToWebview();
}

/**
 * 打开 MCP 设置文件
 */
export async function handleOpenMcpSettings(instance: ClineProvider) {
	const mcpSettingsFilePath = await instance.mcpHub?.getMcpSettingsFilePath();
	if (mcpSettingsFilePath) {
		await instance.messageService.postMessageToWebview({
			type: 'electron', 
			payload: {
				type: 'openFile',
				filePath: mcpSettingsFilePath
			}
		});
		// openFile(mcpSettingsFilePath)
	}
}

/**
 * 重启 MCP 服务器连接
 */
export async function handleRestartMcpServer(instance: ClineProvider, message: WebviewMessage) {
	try {
		await instance.mcpHub?.restartConnection(message.text!);
	} catch (error) {
		console.error(`Failed to retry connection for ${message.text}:`, error);
	}
}

/**
 * 切换 MCP 服务器启用/禁用状态
 */
export async function handleToggleMcpServer(instance: ClineProvider, message: WebviewMessage) {
	try {
		await instance.mcpHub?.toggleServerDisabled(message.serverName!, message.disabled!);
	} catch (error) {
		console.error(`Failed to toggle MCP server ${message.serverName}:`, error);
	}
}

/**
 * 更新 MCP 服务器超时设置
 */
export async function handleUpdateMcpTimeout(instance: ClineProvider, message: WebviewMessage) {
	if (message.serverName && typeof message.timeout === 'number') {
		try {
			await instance.mcpHub?.updateServerTimeout(message.serverName, message.timeout);
		} catch (error) {
			console.error(`Failed to update timeout for ${message.serverName}:`, error);
			vscode.window.showErrorMessage('Failed to update server timeout');
		}
	}
}

/**
 * 设置是否始终允许 MCP
 */
export async function handleAlwaysAllowMcp(instance: ClineProvider, message: WebviewMessage) {
	await instance.updateConfig('alwaysAllowMcp', message.bool);
	await instance.postStateToWebview();
}
