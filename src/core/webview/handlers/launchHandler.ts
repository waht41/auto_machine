import { type ClineProvider } from '@core/webview/ClineProvider';
import { getTheme } from '@/integrations/theme/getTheme';

export const launchHandlers = {
	'webviewDidLaunch': handleWebviewDidLaunch,
	'didShowAnnouncement': handleDidShowAnnouncement,
};

/**
 * 处理 webview 启动事件
 */
export async function handleWebviewDidLaunch(instance: ClineProvider) {
	await instance.messageService.postMessageToWebview({ 
		type: 'toolCategories', 
		toolCategories: instance.toolCategories 
	});
	await instance.messageService.postMessageToWebview({ 
		type: 'allowedTools', 
		allowedTools: instance.allowedToolTree.getAllowedTools() 
	});

	await instance.postStateToWebview();
	instance.workspaceTracker?.initializeFilePaths(); // don't await
    
	const theme = await getTheme();
	await instance.messageService.postMessageToWebview({ 
		type: 'theme', 
		text: JSON.stringify(theme) 
	});
    
	// post last cached models in case the call to endpoint fails
	const openRouterModels = await instance.apiManager.readOpenRouterModels();
	if (openRouterModels) {
		await instance.messageService.postMessageToWebview({ 
			type: 'openRouterModels', 
			openRouterModels 
		});
	}
    
	// gui relies on model info to be up-to-date to provide the most accurate pricing, so we need to fetch the latest details on launch.
	// we do this for all users since many users switch between api providers and if they were to switch back to openrouter it would be showing outdated model info if we hadn't retrieved the latest at this point
	// (see normalizeApiConfiguration > openrouter)
	const refreshedOpenRouterModels = await instance.apiManager.refreshOpenRouterModels();
	if (refreshedOpenRouterModels) {
		// update model info in state (this needs to be done here since we don't want to update state while settings is open, and we may refresh models there)
		const { apiConfiguration } = await instance.getState();
		if (apiConfiguration.openRouterModelId) {
			await instance.updateGlobalState(
				'openRouterModelInfo',
				refreshedOpenRouterModels[apiConfiguration.openRouterModelId],
			);
			await instance.postStateToWebview();
		}
	}
    
	const glamaModels = await instance.apiManager.readGlamaModels();
	if (glamaModels) {
		await instance.messageService.postMessageToWebview({ 
			type: 'glamaModels', 
			glamaModels 
		});
	}
    
	const refreshedGlamaModels = await instance.apiManager.refreshGlamaModels();
	if (refreshedGlamaModels) {
		// update model info in state (this needs to be done here since we don't want to update state while settings is open, and we may refresh models there)
		const { apiConfiguration } = await instance.getState();
		if (apiConfiguration.glamaModelId) {
			await instance.updateGlobalState(
				'glamaModelInfo',
				refreshedGlamaModels[apiConfiguration.glamaModelId],
			);
			await instance.postStateToWebview();
		}
	}
}

/**
 * 处理公告已显示事件
 */
export async function handleDidShowAnnouncement(instance: ClineProvider) {
	await instance.updateGlobalState('lastShownAnnouncementId', instance.latestAnnouncementId);
	await instance.postStateToWebview();
}
