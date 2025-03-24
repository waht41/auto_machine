import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import * as vscode from 'vscode';
import { searchCommits } from '@/utils/git';

export const diffHandlers = {
	'searchCommits': handleSearchCommits,
	'experimentalDiffStrategy': handleExperimentalDiffStrategy,
};

/**
 * 处理搜索提交记录
 */
export async function handleSearchCommits(instance: ClineProvider, message: WebviewMessage) {
	const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0);
	if (cwd) {
		try {
			const commits = await searchCommits(message.query || '', cwd);
			await instance.messageService.postMessageToWebview({
				type: 'commitSearchResults',
				commits,
			});
		} catch (error) {
			console.error('Error searching commits:', error);
			vscode.window.showErrorMessage('Failed to search commits');
		}
	}
}

/**
 * 处理实验性差异比较策略设置
 */
export async function handleExperimentalDiffStrategy(instance: ClineProvider, message: WebviewMessage) {
	await instance.updateGlobalState('experimentalDiffStrategy', message.bool ?? false);
	// Update diffStrategy in current Cline instance if it exists
	if (instance.cline) {
		await instance.cline.updateDiffStrategy(message.bool ?? false);
	}
	await instance.postStateToWebview();
}
