import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { generateMarkdown } from '@/integrations/misc/export-markdown';
import { getTheme } from '@/integrations/theme/getTheme';
import WorkspaceTracker from '../../integrations/workspace/WorkspaceTracker';
import { McpHub } from '@operation/MCP';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { WebviewMessage } from '@/shared/WebviewMessage';
import { PromptComponent } from '@/shared/modes';
import { fileExistsAtPath } from '@/utils/fs';
import { Cline } from '../Cline';
import { setSoundEnabled } from '@/utils/sound';
import { configPath, createIfNotExists, getPromptPath, getUserDataPath } from '@core/storage/common';
import { ApprovalMiddleWrapper } from '@core/internal-implementation/middleware';
import { getToolCategory } from '@core/tool-adapter/getToolCategory';
import { AllowedToolTree } from '@core/tool-adapter/AllowedToolTree';
import { ClineNode, ICreateSubCline, SecretKey } from '@core/webview/type';
import ApiProviderManager from '@core/manager/ApiProviderManager';
import { MessageService } from '@core/services/MessageService';
import { StateService } from '@core/services/StateService';
import { safeExecuteMiddleware } from '@executors/middleware';
import { GlobalFileNames } from '@core/webview/const';
import process from 'node:process';
import { IConfig } from '@core/storage/type';
import logger from '@/utils/logger';
import { handlers } from '@core/webview/handlers';
import { InterClineMessage } from '@core/services/type';

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export class ClineProvider implements vscode.WebviewViewProvider {
	private static activeInstances: Set<ClineProvider> = new Set();
	private disposables: vscode.Disposable[] = [];
	private view?: vscode.WebviewView | vscode.WebviewPanel;
	cline?: Cline;
	workspaceTracker?: WorkspaceTracker;
	mcpHub?: McpHub;
	latestAnnouncementId = 'jan-21-2025-custom-modes'; // update to some unique identifier when we add a new announcement
	toolCategories = getToolCategory(path.join(getPromptPath(),'external-prompt'));
	allowedToolTree = new AllowedToolTree([],this.toolCategories);
	apiManager : ApiProviderManager;
	readonly messageService : MessageService;
	stateService : StateService;
	private clineTree: Map<string, ClineNode> = new Map<string, ClineNode>();

	constructor(
    private sendToMainProcess: (message: any) => void
	) {
		createIfNotExists(configPath);
		this.messageService = MessageService.getInstance();
		this.messageService.setPostMessage(this.sendToMainProcess);
		this.apiManager = ApiProviderManager.getInstance(configPath, this.messageService);
		ClineProvider.activeInstances.add(this);
		this.workspaceTracker = new WorkspaceTracker(this);
		this.mcpHub = new McpHub(path.join(configPath,GlobalFileNames.mcpSettings),this.postMessageToWebview.bind(this));
		this.stateService = StateService.getInstance();
	}

	async init() {
		await this.stateService.init();
		await this.setUpAllowedTools();
		await this.mcpHub?.initialize();
	}

	public get config() { // todo waht 临时方案，待删
		return this.stateService.getConfig();
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		await this.clearTask();
		if (this.view && 'dispose' in this.view) {
			this.view.dispose();
		}
		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
		this.workspaceTracker?.dispose();
		this.workspaceTracker = undefined;
		this.mcpHub?.dispose();
		this.mcpHub = undefined;
		ClineProvider.activeInstances.delete(this);
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView | vscode.WebviewPanel,
		//context: vscode.WebviewViewResolveContext<unknown>, used to recreate a deallocated webview, but we don't need this since we use retainContextWhenHidden
		//token: vscode.CancellationToken
	): void | Thenable<void> {
		this.view = webviewView;

		// Initialize sound enabled state
		this.getState().then(({ soundEnabled }) => {
			setSoundEnabled(soundEnabled ?? false);
		});

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is recieved
		this.setWebviewMessageListener(webviewView.webview);

		// Listen for when the view is disposed
		// This happens when the user closes the view or when the view is closed programmatically
		webviewView.onDidDispose(
			async () => {
				await this.dispose();
			},
			null,
			this.disposables,
		);

		// Listen for when color changes
		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration('workbench.colorTheme')) {
					// Sends latest theme name to webview
					await this.postMessageToWebview({ type: 'theme', text: JSON.stringify(await getTheme()) });
				}
			},
			null,
			this.disposables,
		);

		// if the extension is starting a new session, clear previous task state
		this.clearTask();
	}

	private async addChildToParent(parentId: string | undefined, childId: string) {
		if (!parentId) return;

		const child = this.clineTree.get(childId);
		if (!child) {
			logger.warn(`child ${childId} not exist`);
			return;
		}


		const parent = this.clineTree.get(parentId);
		if (!parent) {
			logger.error(`add child to parent: has parentId but no parent in tree, parent: ${parentId}  child:${childId}`);
			return;
		}

		child.parentId = parentId;
		await child.cline.setParentId(parentId);
		parent.children ??= [];
		parent.children.push(childId);
	}

	private async createSubCline(prop:ICreateSubCline) {
		const cline = await this.createCline(undefined, true);
		await this.addChildToParent(prop.parentId, cline.taskId);
		cline.start({task: prop.task, images: prop.images});
		return cline.taskId;
	}

	private async createCline(historyItem?:HistoryItem, subCline?:boolean){
		const {
			apiConfiguration,
			customModePrompts,
			mode,
			customInstructions: globalInstructions,
			taskDirRoot,
		} = await this.getState();
		const modePrompt = customModePrompts?.[mode] as PromptComponent;
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join('\n\n');

		const cline = new Cline(
			{
				apiConfiguration,
				postMessageToWebview: this.postMessageToWebview.bind(this),
				postStateToWebview: this.postStateToWebview.bind(this),
				updateTaskHistory: this.updateTaskHistory.bind(this),
				postInterClineMessage: this.postInterClineMessage.bind(this),
				createCline: this.createSubCline.bind(this),
				customInstructions: effectiveInstructions,
				historyItem,
				middleWares: [safeExecuteMiddleware, ApprovalMiddleWrapper(this.allowedToolTree)],
				mcpHub: this.mcpHub,
				taskParentDir: taskDirRoot,
				memoryDir: path.join(getUserDataPath(),'memory'),
				allowedToolTree: this.allowedToolTree
			}
		);
		await cline.init();

		const clineNode: ClineNode = {
			cline,
			id: cline.taskId,
		};
		this.clineTree.set(clineNode.id, clineNode);

		if (!subCline){
			this.cline = cline;
			await this.postMessageToWebview({type:'setTaskId',taskId:cline.taskId});
		}

		return cline;
	}

	public async initClineWithTask(task?: string, images?: string[]) {
		await this.clearTask();
		console.log('initClineWithTask task', task);
		const cline = await this.createCline();
		await cline.start({task,images});
		await this.postMessageToWebview({type: 'openTab', taskId: cline.taskId, task: task??'empty task'});
	}

	public async initClineWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask();
		const cline =  await this.createCline(historyItem);
		await cline.resume({text:historyItem.newMessage,images:historyItem.newImages});
		await this.postMessageToWebview({type: 'openTab', taskId: cline.taskId, task: await cline.getTask()});
	}

	isActivate(clineId: string): boolean {
		return this.clineTree.has(clineId);
	}
	public async switchCline(clineId: string) {
		console.log(`switchCline in provider: ${clineId}`);
		if (this.clineTree.has(clineId)){
			this.cline = this.clineTree.get(clineId)!.cline;
		} else {
			const historyItem = (await this.getTaskWithId(clineId)).historyItem;
			this.cline = await this.createCline(historyItem);
		}

		await this.postMessageToWebview({type:'setTaskId', taskId:clineId});
		await this.cline.postClineMessage();
	}

	public async postMessageToWebview(message: ExtensionMessage) {
		await this.messageService.postMessageToWebview(message);
	}

	private async setUpAllowedTools(){
		const allowedTools = this.config.get('allowedCommands');
		this.allowedToolTree.setAllowedTools(allowedTools?? []);
	}


	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is recieved.
	 *
	 * @param webview A reference to the extension webview
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				if (Object.keys(handlers).includes(message.type)){
					await handlers[message.type](this,message);
					return;
				} else {
					console.error('Unknown message type:', message.type);
					logger.error('onDidReceiveMessage Unknown message type:', message.type);
				}
			},
			null,
			this.disposables,
		);
	}
	async setAllowedTools(toolId: string| string[]) {
		const newCommands = this.allowedToolTree.setAllowedTools(toolId);

		await this.config.set('allowedCommands', newCommands);
		this.postMessageToWebview({
			type: 'allowedTools',
			allowedTools: newCommands
		});
	}


	// VSCode LM API
	async getVsCodeLmModels() {
		try {
			const models = await vscode.lm.selectChatModels({});
			return models || [];
		} catch (error) {
			console.error('Error fetching VS Code LM models:', error);
			return [];
		}
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = this.stateService.getTaskHistory();
		logger.debug('getTaskWithId history: ', history, 'id:',id);

		const historyItem = history.find((item) => item.id === id);
		if (historyItem) {
			const taskDirRoot: string = this.config.get('taskDirRoot');
			const taskDirPath = path.join(taskDirRoot, id);
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory);
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages);
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath);
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, 'utf8'));
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					apiConversationHistory,
				};
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		// FIXME: this seems to happen sometimes when the json file doesnt save to disk for some reason
		await this.deleteTaskFromState(id);
		throw new Error('Task not found');
	}

	async showTaskWithId(id: string) {
		if (id !== this.cline?.taskId) {
			// non-current task
			// await this.clearTask();
			const { historyItem } = await this.getTaskWithId(id);
			const cline = await this.createCline(historyItem);
			await cline.postClineMessage();
			await this.postMessageToWebview({type: 'openTab', taskId: cline.taskId, task: historyItem.task});
		}
		await this.postMessageToWebview({ type: 'action', action: 'chatButtonClicked' });
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id);
		const content = await generateMarkdown(historyItem.ts, apiConversationHistory);
		this.postMessageToWebview({
			type: 'electron', payload: {
				type: 'export',
				title: historyItem.task + '_' + historyItem.ts + '.md',
				content
			}
		});
	}

	async deleteTaskWithId(id: string) {
		if (id === this.cline?.taskId) {
			await this.clearTask();
		}

		const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath } = await this.getTaskWithId(id);

		await this.deleteTaskFromState(id);

		// Delete the task files
		const apiConversationHistoryFileExists = await fileExistsAtPath(apiConversationHistoryFilePath);
		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath);
		}
		const uiMessagesFileExists = await fileExistsAtPath(uiMessagesFilePath);
		if (uiMessagesFileExists) {
			await fs.unlink(uiMessagesFilePath);
		}
		const legacyMessagesFilePath = path.join(taskDirPath, 'claude_messages.json');
		if (await fileExistsAtPath(legacyMessagesFilePath)) {
			await fs.unlink(legacyMessagesFilePath);
		}
		await fs.rmdir(taskDirPath); // succeeds if the dir is empty
	}

	async deleteTaskFromState(id: string) {
		// Remove the task from history
		await this.stateService.deleteTaskHistory(id);

		// Notify the webview that the task has been deleted
		await this.postStateToWebview();
	}

	async postStateToWebview() {
		const state = await this.getSharedContext();
		//@ts-ignore  todo 需要重写extensionState
		await this.postMessageToWebview({ type: 'state', state });
	}

	async postInterClineMessage(message: InterClineMessage) {
		const targetId = message.targetId;
		const targetCline = this.clineTree.get(targetId);
		if (!targetCline) {
			logger.error('post inter cline message, no such target cline', message);
			return;
		}
		targetCline.cline.receiveInterMessage(message);
	}

	async getSharedContext() {
		const state = await this.getState();
		const { lastShownAnnouncementId, ...restState } = state;
		const taskHistory = this.stateService.getTaskHistory();
		return {
			version: process.env?.version ?? '',
			uriScheme: vscode.env.uriScheme,
			taskHistory: (taskHistory || [])
				.filter((item: HistoryItem) => item.ts && item.task)
				.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts),
			shouldShowAnnouncement: lastShownAnnouncementId !== this.latestAnnouncementId,
			...restState
		};
	}

	async clearTask() {
		this.cline?.abortTask();
		this.cline = undefined; // removes reference to it, so once promises end it will be garbage collected
	}

	async getState() {
		return await this.stateService.getState();
	}

	async updateTaskHistory(item: HistoryItem) {
		const cline = this.clineTree.get(item.id);
		let parent = undefined;
		let children = undefined;
		if (cline) {
			parent = cline.parentId;
			children = cline.children;
		}
		await this.stateService.addTaskHistory({ ...item, parent, children });
		await this.postStateToWebview();
	}

	// global

	async updateConfig(key: keyof IConfig, value: unknown) {
		await this.config.set(key, value);
	}

	async getGlobalState<T extends keyof IConfig>(key: T)  {
		return this.config.get(key);
	}

	// secrets

	private async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this.stateService.storeSecret(key, value);
		} else {
			await this.stateService.deleteSecret(key);
		}
	}

	// dev

	async resetState() {
		console.log('[Cline provider] Resetting state');
		const answer = await vscode.window.showInformationMessage(
			'Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.',
			{ modal: true },
			'Yes',
		);

		if (answer !== 'Yes') {
			return;
		}

		for (const key in this.config.keys()) {
			await this.config.set(key as keyof IConfig, undefined);
		}
		const secretKeys: SecretKey[] = [
			'apiKey',
			'glamaApiKey',
			'openRouterApiKey',
			'awsAccessKey',
			'awsSecretKey',
			'awsSessionToken',
			'openAiApiKey',
			'geminiApiKey',
			'openAiNativeApiKey',
			'deepSeekApiKey',
			'mistralApiKey',
		];
		for (const key of secretKeys) {
			await this.storeSecret(key, undefined);
		}
		if (this.cline) {
			this.cline.abortTask();
			this.cline = undefined;
		}
		await this.postStateToWebview();
		await this.postMessageToWebview({ type: 'action', action: 'chatButtonClicked' });
	}
}
