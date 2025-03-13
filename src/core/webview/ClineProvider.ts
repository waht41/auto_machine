import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import pWaitFor from 'p-wait-for';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildApiHandler } from '@/api';
import { generateMarkdown } from '@/integrations/misc/export-markdown';
import { openFile, openImage } from '@/integrations/misc/open-file';
import { selectImages } from '@/integrations/misc/process-images';
import { getTheme } from '@/integrations/theme/getTheme';
import { getDiffStrategy } from '../diff/DiffStrategy';
import WorkspaceTracker from '../../integrations/workspace/WorkspaceTracker';
import { McpHub } from '@operation/MCP';
import { ApiConfiguration } from '@/shared/api';
import { findLast } from '@/shared/array';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { WebviewMessage } from '@/shared/WebviewMessage';
import { defaultModeSlug, Mode, PromptComponent, } from '@/shared/modes';
import { SYSTEM_PROMPT } from '../prompts/system';
import { fileExistsAtPath } from '@/utils/fs';
import { Cline } from '../Cline';
import { openMention } from '../mentions';
import { playSound, setSoundEnabled, setSoundVolume } from '@/utils/sound';
import { checkExistKey } from '@/shared/checkExistApiConfig';
import { singleCompletionHandler } from '@/utils/single-completion-handler';
import { searchCommits } from '@/utils/git';
import { ConfigManager } from '../config/ConfigManager';
import { CustomModesManager } from '../config/CustomModesManager';
import { supportPrompt } from '@/shared/support-prompt';
import { GlobalState } from '@core/storage/global-state';
import { configPath, createIfNotExists, getAssetPath } from '@core/storage/common';
import { ApprovalMiddleWrapper } from '@core/internal-implementation/middleware';
import { getToolCategory } from '@core/tool-adapter/getToolCategory';
import { AllowedToolTree } from '@core/tool-adapter/AllowedToolTree';
import { GlobalStateKey, SecretKey } from '@core/webview/type';
import ApiProviderManager from '@core/manager/ApiProviderManager';
import { MessageService } from '@core/services/MessageService';
import { ConfigService } from '@core/services/ConfigService';

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export const GlobalFileNames = {
	apiConversationHistory: 'api_conversation_history.json',
	uiMessages: 'ui_messages.json',
	glamaModels: 'glama_models.json',
	openRouterModels: 'openrouter_models.json',
	mcpSettings: 'cline_mcp_settings.json',
};

export class ClineProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = 'roo-cline.SidebarProvider'; // used in package.json as the view's id. This value cannot be changed due to how vscode caches views based on their id, and updating the id would break existing instances of the extension.
	public static readonly tabPanelId = 'roo-cline.TabPanelProvider';
	private static activeInstances: Set<ClineProvider> = new Set();
	private disposables: vscode.Disposable[] = [];
	private view?: vscode.WebviewView | vscode.WebviewPanel;
	private cline?: Cline;
	private workspaceTracker?: WorkspaceTracker;
	mcpHub?: McpHub;
	private latestAnnouncementId = 'jan-21-2025-custom-modes'; // update to some unique identifier when we add a new announcement
	configManager: ConfigManager;
	customModesManager: CustomModesManager;
	private toolCategories = getToolCategory(path.join(getAssetPath(),'external-prompt'));
	private allowedToolTree = new AllowedToolTree([],this.toolCategories);
	private apiManager : ApiProviderManager;
	private readonly messageService : MessageService;
	private configService : ConfigService;

	constructor(
		readonly context: vscode.ExtensionContext,
    private sendToMainProcess: (message: any) => void
	) {
		createIfNotExists(configPath);
		this.messageService = MessageService.getInstance(this.sendToMainProcess);
		this.apiManager = ApiProviderManager.getInstance(configPath, this.messageService);
		ClineProvider.activeInstances.add(this);
		this.workspaceTracker = new WorkspaceTracker(this);
		this.mcpHub = new McpHub('.',this.postMessageToWebview.bind(this));
		this.mcpHub.initialize();
		this.configManager = new ConfigManager(this.context);
		this.customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview();
		});
		this.configService = ConfigService.getInstance(new GlobalState(path.join(configPath, 'auto_machine_global_state.json')));
	}

	public get globalState(): GlobalState{ // todo waht 临时方案，待删
		return this.configService.getState();
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
		this.customModesManager?.dispose();
		ClineProvider.activeInstances.delete(this);
	}

	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance) => instance.view?.visible === true);
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

	private async createCline({task,images,historyItem}: { task?:string,images?:string[],historyItem?:HistoryItem }){
		const {
			apiConfiguration,
			customModePrompts,
			diffEnabled,
			fuzzyMatchThreshold,
			mode,
			customInstructions: globalInstructions,
			experimentalDiffStrategy,
		} = await this.getState();
		const modePrompt = customModePrompts?.[mode] as PromptComponent;
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join('\n\n');

		this.cline = new Cline(
			{
				provider: this,
				apiConfiguration,
				postMessageToWebview: this.postMessageToWebview.bind(this),
				customInstructions: effectiveInstructions,
				enableDiff: diffEnabled,
				fuzzyMatchThreshold,
				task,
				images,
				historyItem,
				experimentalDiffStrategy,
				middleWares: [ApprovalMiddleWrapper(this.allowedToolTree)],
				mcpHub: this.mcpHub,
				taskParentDir: path.join(this.context.globalStorageUri.fsPath,'tasks')
			}
		);
		if (historyItem){
			this.cline.clineMessages = await this.cline.getSavedClineMessages() || [];
		}
	}

	public async initClineWithTask(task?: string, images?: string[]) {
		await this.clearTask();
		await this.createCline({task, images});
		this.cline?.start({task,images});
	}

	public async initClineWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask();
		await this.createCline({historyItem});
		this.cline?.resume({text:historyItem.newMessage,images:historyItem.newImages});
	}

	public async postMessageToWebview(message: ExtensionMessage) {
		await this.messageService.postMessageToWebview(message);
	}

	private async setUpAllowedTools(){
		const allowedTools = await this.globalState.get<string[]>('allowedCommands');
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
				switch (message.type) {
					case 'webviewDidLaunch':
						// Load custom modes first
						const customModes = await this.customModesManager.getCustomModes();
						await this.updateGlobalState('customModes', customModes);

						await this.setUpAllowedTools();
						await this.postMessageToWebview({ type: 'toolCategories', toolCategories: this.toolCategories });
						await this.postMessageToWebview({ type: 'allowedTools', allowedTools:this.allowedToolTree.getAllowedTools() });

						this.postStateToWebview();
						this.workspaceTracker?.initializeFilePaths(); // don't await
						getTheme().then((theme) =>
							this.postMessageToWebview({ type: 'theme', text: JSON.stringify(theme) }),
						);
						// post last cached models in case the call to endpoint fails
						this.apiManager.readOpenRouterModels().then((openRouterModels) => {
							if (openRouterModels) {
								this.postMessageToWebview({ type: 'openRouterModels', openRouterModels });
							}
						});
						// gui relies on model info to be up-to-date to provide the most accurate pricing, so we need to fetch the latest details on launch.
						// we do this for all users since many users switch between api providers and if they were to switch back to openrouter it would be showing outdated model info if we hadn't retrieved the latest at this point
						// (see normalizeApiConfiguration > openrouter)
						this.apiManager.refreshOpenRouterModels().then(async (openRouterModels) => {
							if (openRouterModels) {
								// update model info in state (this needs to be done here since we don't want to update state while settings is open, and we may refresh models there)
								const { apiConfiguration } = await this.getState();
								if (apiConfiguration.openRouterModelId) {
									await this.updateGlobalState(
										'openRouterModelInfo',
										openRouterModels[apiConfiguration.openRouterModelId],
									);
									await this.postStateToWebview();
								}
							}
						});
						this.apiManager.readGlamaModels().then((glamaModels) => {
							if (glamaModels) {
								this.postMessageToWebview({ type: 'glamaModels', glamaModels });
							}
						});
						this.apiManager.refreshGlamaModels().then(async (glamaModels) => {
							if (glamaModels) {
								// update model info in state (this needs to be done here since we don't want to update state while settings is open, and we may refresh models there)
								const { apiConfiguration } = await this.getState();
								if (apiConfiguration.glamaModelId) {
									await this.updateGlobalState(
										'glamaModelInfo',
										glamaModels[apiConfiguration.glamaModelId],
									);
									await this.postStateToWebview();
								}
							}
						});

						this.configManager
							.listConfig()
							.then(async (listApiConfig) => {
								if (!listApiConfig) {
									return;
								}

								if (listApiConfig.length === 1) {
									// check if first time init then sync with exist config
									if (!checkExistKey(listApiConfig[0])) {
										const { apiConfiguration } = await this.getState();
										await this.configManager.saveConfig(
											listApiConfig[0].name ?? 'default',
											apiConfiguration,
										);
										listApiConfig[0].apiProvider = apiConfiguration.apiProvider;
									}
								}

								const currentConfigName = (await this.getGlobalState('currentApiConfigName')) as string;

								if (currentConfigName) {
									if (!(await this.configManager.hasConfig(currentConfigName))) {
										// current config name not valid, get first config in list
										await this.updateGlobalState('currentApiConfigName', listApiConfig?.[0]?.name);
										if (listApiConfig?.[0]?.name) {
											const apiConfig = await this.configManager.loadConfig(
												listApiConfig?.[0]?.name,
											);

											await Promise.all([
												this.updateGlobalState('listApiConfigMeta', listApiConfig),
												this.postMessageToWebview({ type: 'listApiConfig', listApiConfig }),
												this.updateApiConfiguration(apiConfig),
											]);
											await this.postStateToWebview();
											return;
										}
									}
								}

								await Promise.all([
									await this.updateGlobalState('listApiConfigMeta', listApiConfig),
									await this.postMessageToWebview({ type: 'listApiConfig', listApiConfig }),
								]);
							})
							.catch(console.error);

						break;
					case 'newTask':
						// Code that should run in response to the hello message command
						//vscode.window.showInformationMessage(message.text!)

						// Send a message to our webview.
						// You can send any JSON serializable data.
						// Could also do this in extension .ts
						//this.postMessageToWebview({ type: "text", text: `Extension: ${Date.now()}` })
						// initializing new instance of Cline will make sure that any agentically running promises in old instance don't affect our new task. this essentially creates a fresh slate for the new task
						await this.initClineWithTask(message.text, message.images);
						break;
					case 'resumeTask':
						if (this.cline){
							const { historyItem } = await this.getTaskWithId(this.cline.taskId);
							console.log('[waht] history item', historyItem);
							await this.initClineWithHistoryItem(Object.assign(historyItem, {newMessage: message.text, newImages: message.images}));
						} else {
							await this.initClineWithTask(message.text, message.images);
						}

						break;
					case 'apiConfiguration':
						if (message.apiConfiguration) {
							await this.updateApiConfiguration(message.apiConfiguration);
						}
						await this.postStateToWebview();
						break;
					case 'customInstructions':
						await this.updateCustomInstructions(message.text);
						break;
					case 'alwaysAllowMcp':
						await this.updateGlobalState('alwaysAllowMcp', message.bool);
						await this.postStateToWebview();
						break;
					case 'askResponse':
						this.cline?.handleWebviewAskResponse(message.askResponse!, message.text, message.images);
						break;
					case 'clearTask':
						// newTask will start a new task with a given task text, while clear task resets the current session and allows for a new task to be started
						await this.clearTask();
						await this.postStateToWebview();
						break;
					case 'didShowAnnouncement':
						await this.updateGlobalState('lastShownAnnouncementId', this.latestAnnouncementId);
						await this.postStateToWebview();
						break;
					case 'selectImages':
						const images = await selectImages();
						await this.postMessageToWebview({ type: 'selectedImages', images });
						break;
					case 'exportCurrentTask':
						const currentTaskId = this.cline?.taskId;
						if (currentTaskId) {
							this.exportTaskWithId(currentTaskId);
						}
						break;
					case 'showTaskWithId':
						this.showTaskWithId(message.text!);
						break;
					case 'deleteTaskWithId':
						this.deleteTaskWithId(message.text!);
						break;
					case 'exportTaskWithId':
						this.exportTaskWithId(message.text!);
						break;
					case 'resetState':
						await this.resetState();
						break;
					case 'requestOllamaModels':
						const ollamaModels = await this.apiManager.getOllamaModels(message.text);
						this.postMessageToWebview({ type: 'ollamaModels', ollamaModels });
						break;
					case 'requestLmStudioModels':
						const lmStudioModels = await this.apiManager.getLmStudioModels(message.text);
						this.postMessageToWebview({ type: 'lmStudioModels', lmStudioModels });
						break;
					case 'requestVsCodeLmModels':
						const vsCodeLmModels = await this.getVsCodeLmModels();
						this.postMessageToWebview({ type: 'vsCodeLmModels', vsCodeLmModels });
						break;
					case 'refreshGlamaModels':
						await this.apiManager.refreshGlamaModels();
						break;
					case 'refreshOpenRouterModels':
						await this.apiManager.refreshOpenRouterModels();
						break;
					case 'refreshOpenAiModels':
						if (message?.values?.baseUrl && message?.values?.apiKey) {
							const openAiModels = await this.apiManager.getOpenAiModels(
								message?.values?.baseUrl,
								message?.values?.apiKey,
							);
							this.postMessageToWebview({ type: 'openAiModels', openAiModels });
						}
						break;
					case 'openImage':
						openImage(message.text!);
						break;
					case 'openFile':
						openFile(message.text!, message.values as { create?: boolean; content?: string });
						break;
					case 'openMention':
						openMention(message.text);
						break;
					case 'cancelTask':
						if (this.cline) {
							const { historyItem } = await this.getTaskWithId(this.cline.taskId);
							this.cline.abortTask();
							await pWaitFor(() => this.cline === undefined || this.cline.didFinishAborting, {
								timeout: 3_000,
							}).catch(() => {
								console.error('Failed to abort task');
							});
							if (this.cline) {
								// 'abandoned' will prevent this cline instance from affecting future cline instance gui. this may happen if its hanging on a streaming request
								this.cline.abandoned = true;
							}
							await this.initClineWithHistoryItem(historyItem); // clears task again, so we need to abortTask manually above
							// await this.postStateToWebview() // new Cline instance will post state when it's ready. having this here sent an empty messages array to webview leading to virtuoso having to reload the entire list
						}

						break;
					case 'allowedCommands':
						await this.globalState.set('allowedCommands', message.commands);
						// Also update workspace settings
						await vscode.workspace
							.getConfiguration('roo-cline')
							.update('allowedCommands', message.commands, vscode.ConfigurationTarget.Global);
						break;
					case 'openMcpSettings': {
						const mcpSettingsFilePath = await this.mcpHub?.getMcpSettingsFilePath();
						if (mcpSettingsFilePath) {
							this.postMessageToWebview({
								type: 'electron', payload: {
									type: 'openFile',
									filePath: mcpSettingsFilePath
								}
							});
							// openFile(mcpSettingsFilePath)
						}
						break;
					}
					case 'openCustomModesSettings': {
						const customModesFilePath = await this.customModesManager.getCustomModesFilePath();
						if (customModesFilePath) {
							openFile(customModesFilePath);
						}
						break;
					}
					case 'restartMcpServer': {
						try {
							await this.mcpHub?.restartConnection(message.text!);
						} catch (error) {
							console.error(`Failed to retry connection for ${message.text}:`, error);
						}
						break;
					}
					case 'toggleToolAlwaysAllow': {
						try {
							await this.mcpHub?.toggleToolAlwaysAllow(
								message.serverName!,
								message.toolName!,
								message.alwaysAllow!,
							);
						} catch (error) {
							console.error(`Failed to toggle auto-approve for tool ${message.toolName}:`, error);
						}
						break;
					}
					case 'toggleMcpServer': {
						try {
							await this.mcpHub?.toggleServerDisabled(message.serverName!, message.disabled!);
						} catch (error) {
							console.error(`Failed to toggle MCP server ${message.serverName}:`, error);
						}
						break;
					}
					case 'mcpEnabled':
						const mcpEnabled = message.bool ?? true;
						await this.updateGlobalState('mcpEnabled', mcpEnabled);
						await this.postStateToWebview();
						break;
					case 'playSound':
						if (message.audioType) {
							const soundPath = path.join(this.context.extensionPath, 'audio', `${message.audioType}.wav`);
							playSound(soundPath);
						}
						break;
					case 'soundEnabled':
						const soundEnabled = message.bool ?? true;
						await this.updateGlobalState('soundEnabled', soundEnabled);
						setSoundEnabled(soundEnabled); // Add this line to update the sound utility
						await this.postStateToWebview();
						break;
					case 'soundVolume':
						const soundVolume = message.value ?? 0.5;
						await this.updateGlobalState('soundVolume', soundVolume);
						setSoundVolume(soundVolume);
						await this.postStateToWebview();
						break;
					case 'diffEnabled':
						const diffEnabled = message.bool ?? true;
						await this.updateGlobalState('diffEnabled', diffEnabled);
						await this.postStateToWebview();
						break;
					case 'browserViewportSize':
						const browserViewportSize = message.text ?? '900x600';
						await this.updateGlobalState('browserViewportSize', browserViewportSize);
						await this.postStateToWebview();
						break;
					case 'fuzzyMatchThreshold':
						await this.updateGlobalState('fuzzyMatchThreshold', message.value);
						await this.postStateToWebview();
						break;
					case 'alwaysApproveResubmit':
						await this.updateGlobalState('alwaysApproveResubmit', message.bool ?? false);
						await this.postStateToWebview();
						break;
					case 'requestDelaySeconds':
						await this.updateGlobalState('requestDelaySeconds', message.value ?? 5);
						await this.postStateToWebview();
						break;
					case 'preferredLanguage':
						await this.updateGlobalState('preferredLanguage', message.text);
						await this.postStateToWebview();
						break;
					case 'writeDelayMs':
						await this.updateGlobalState('writeDelayMs', message.value);
						await this.postStateToWebview();
						break;
					case 'terminalOutputLineLimit':
						await this.updateGlobalState('terminalOutputLineLimit', message.value);
						await this.postStateToWebview();
						break;
					case 'mode':
						await this.handleModeSwitch(message.text as Mode);
						break;
					case 'updateSupportPrompt':
						try {
							if (Object.keys(message?.values ?? {}).length === 0) {
								return;
							}

							const existingPrompts = (await this.getGlobalState('customSupportPrompts')) || {};

							const updatedPrompts = {
								...existingPrompts,
								...message.values,
							};

							await this.updateGlobalState('customSupportPrompts', updatedPrompts);
							await this.postStateToWebview();
						} catch (error) {
							console.error('Error update support prompt:', error);
							vscode.window.showErrorMessage('Failed to update support prompt');
						}
						break;
					case 'resetSupportPrompt':
						try {
							if (!message?.text) {
								return;
							}

							const existingPrompts = ((await this.getGlobalState('customSupportPrompts')) ||
								{}) as Record<string, unknown>;

							const updatedPrompts = {
								...existingPrompts,
							};

							updatedPrompts[message.text] = undefined;

							await this.updateGlobalState('customSupportPrompts', updatedPrompts);
							await this.postStateToWebview();
						} catch (error) {
							console.error('Error reset support prompt:', error);
							vscode.window.showErrorMessage('Failed to reset support prompt');
						}
						break;
					case 'updatePrompt':
						if (message.promptMode && message.customPrompt !== undefined) {
							const existingPrompts = (await this.getGlobalState('customModePrompts')) || {};

							const updatedPrompts = {
								...existingPrompts,
								[message.promptMode]: message.customPrompt,
							};

							await this.updateGlobalState('customModePrompts', updatedPrompts);

							// Get current state and explicitly include customModePrompts
							const currentState = await this.getState();

							const stateWithPrompts = {
								...currentState,
								customModePrompts: updatedPrompts,
							};

							// Post state with prompts
							this.view?.webview.postMessage({
								type: 'state',
								state: stateWithPrompts,
							});
						}
						break;
					case 'deleteMessage': {
						const answer = await vscode.window.showInformationMessage(
							'What would you like to delete?',
							{ modal: true },
							'Just this message',
							'This and all subsequent messages',
						);
						if (
							(answer === 'Just this message' || answer === 'This and all subsequent messages') &&
							this.cline &&
							typeof message.value === 'number' &&
							message.value
						) {
							const timeCutoff = message.value - 1000; // 1 second buffer before the message to delete
							const messageIndex = this.cline.clineMessages.findIndex(
								(msg) => msg.ts && msg.ts >= timeCutoff,
							);
							const apiConversationHistoryIndex = this.cline.apiConversationHistory.findIndex(
								(msg) => msg.ts && msg.ts >= timeCutoff,
							);

							if (messageIndex !== -1) {
								const { historyItem } = await this.getTaskWithId(this.cline.taskId);

								if (answer === 'Just this message') {
									// Find the next user message first
									const nextUserMessage = this.cline.clineMessages
										.slice(messageIndex + 1)
										.find((msg) => msg.type === 'say' && msg.say === 'user_feedback');

									// Handle UI messages
									if (nextUserMessage) {
										// Find absolute index of next user message
										const nextUserMessageIndex = this.cline.clineMessages.findIndex(
											(msg) => msg === nextUserMessage,
										);
										// Keep messages before current message and after next user message
										await this.cline.overwriteClineMessages([
											...this.cline.clineMessages.slice(0, messageIndex),
											...this.cline.clineMessages.slice(nextUserMessageIndex),
										]);
									} else {
										// If no next user message, keep only messages before current message
										await this.cline.overwriteClineMessages(
											this.cline.clineMessages.slice(0, messageIndex),
										);
									}

									// Handle API messages
									if (apiConversationHistoryIndex !== -1) {
										if (nextUserMessage && nextUserMessage.ts) {
											// Keep messages before current API message and after next user message
											await this.cline.overwriteApiConversationHistory([
												...this.cline.apiConversationHistory.slice(
													0,
													apiConversationHistoryIndex,
												),
												...this.cline.apiConversationHistory.filter(
													(msg) => msg.ts && msg.ts >= nextUserMessage.ts,
												),
											]);
										} else {
											// If no next user message, keep only messages before current API message
											await this.cline.overwriteApiConversationHistory(
												this.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
											);
										}
									}
								} else if (answer === 'This and all subsequent messages') {
									// Delete this message and all that follow
									await this.cline.overwriteClineMessages(
										this.cline.clineMessages.slice(0, messageIndex),
									);
									if (apiConversationHistoryIndex !== -1) {
										await this.cline.overwriteApiConversationHistory(
											this.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
										);
									}
								}

								await this.initClineWithHistoryItem(historyItem);
							}
						}
						break;
					}
					case 'screenshotQuality':
						await this.updateGlobalState('screenshotQuality', message.value);
						await this.postStateToWebview();
						break;
					case 'enhancementApiConfigId':
						await this.updateGlobalState('enhancementApiConfigId', message.text);
						await this.postStateToWebview();
						break;
					case 'autoApprovalEnabled':
						await this.updateGlobalState('autoApprovalEnabled', message.bool ?? false);
						await this.postStateToWebview();
						break;
					case 'enhancePrompt':
						if (message.text) {
							try {
								const {
									apiConfiguration,
									customSupportPrompts,
									listApiConfigMeta,
									enhancementApiConfigId,
								} = await this.getState();

								// Try to get enhancement config first, fall back to current config
								let configToUse: ApiConfiguration = apiConfiguration;
								if (enhancementApiConfigId) {
									const config = listApiConfigMeta?.find((c: any) => c.id === enhancementApiConfigId);
									if (config?.name) {
										const loadedConfig = await this.configManager.loadConfig(config.name);
										if (loadedConfig.apiProvider) {
											configToUse = loadedConfig;
										}
									}
								}

								const enhancedPrompt = await singleCompletionHandler(
									configToUse,
									supportPrompt.create(
										'ENHANCE',
										{
											userInput: message.text,
										},
										customSupportPrompts,
									),
								);

								await this.postMessageToWebview({
									type: 'enhancedPrompt',
									text: enhancedPrompt,
								});
							} catch (error) {
								console.error('Error enhancing prompt:', error);
								vscode.window.showErrorMessage('Failed to enhance prompt');
								await this.postMessageToWebview({
									type: 'enhancedPrompt',
								});
							}
						}
						break;
					case 'getSystemPrompt':
						try {
							const {
								apiConfiguration,
								customModePrompts,
								customInstructions,
								preferredLanguage,
								browserViewportSize,
								diffEnabled,
								mcpEnabled,
								fuzzyMatchThreshold,
								experimentalDiffStrategy,
							} = await this.getState();

							// Create diffStrategy based on current model and settings
							const diffStrategy = getDiffStrategy(
								apiConfiguration.apiModelId || apiConfiguration.openRouterModelId || '',
								fuzzyMatchThreshold,
								experimentalDiffStrategy,
							);
							const cwd =
								vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) || '';

							const mode = message.mode ?? defaultModeSlug;
							const customModes = await this.customModesManager.getCustomModes();

							const systemPrompt = await SYSTEM_PROMPT(
								this.context,
								cwd,
								apiConfiguration.openRouterModelInfo?.supportsComputerUse ?? false,
								mcpEnabled ? this.mcpHub : undefined,
								diffStrategy,
								browserViewportSize ?? '900x600',
								mode,
								customModePrompts,
								customModes,
								customInstructions,
								preferredLanguage,
								diffEnabled,
							);

							await this.postMessageToWebview({
								type: 'systemPrompt',
								text: systemPrompt,
								mode: message.mode,
							});
						} catch (error) {
							console.error('Error getting system prompt:', error);
							vscode.window.showErrorMessage('Failed to get system prompt');
						}
						break;
					case 'searchCommits': {
						const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0);
						if (cwd) {
							try {
								const commits = await searchCommits(message.query || '', cwd);
								await this.postMessageToWebview({
									type: 'commitSearchResults',
									commits,
								});
							} catch (error) {
								console.error('Error searching commits:', error);
								vscode.window.showErrorMessage('Failed to search commits');
							}
						}
						break;
					}
					case 'upsertApiConfiguration':
						if (message.text && message.apiConfiguration) {
							try {
								console.log('[waht]','upsertApiConfiguration',message.text,message.apiConfiguration);
								await this.configManager.saveConfig(message.text, message.apiConfiguration);
								const listApiConfig = await this.configManager.listConfig();

								await Promise.all([
									this.updateGlobalState('listApiConfigMeta', listApiConfig),
									this.updateApiConfiguration(message.apiConfiguration),
									this.updateGlobalState('currentApiConfigName', message.text),
								]);

								await this.postStateToWebview();
							} catch (error) {
								console.error('Error create new api configuration:', error);
								vscode.window.showErrorMessage('Failed to create api configuration');
							}
						}
						break;
					case 'renameApiConfiguration':
						if (message.values && message.apiConfiguration) {
							try {
								const { oldName, newName } = message.values;

								await this.configManager.saveConfig(newName, message.apiConfiguration);
								await this.configManager.deleteConfig(oldName);

								const listApiConfig = await this.configManager.listConfig();
								const config = listApiConfig?.find((c) => c.name === newName);

								// Update listApiConfigMeta first to ensure UI has latest data
								await this.updateGlobalState('listApiConfigMeta', listApiConfig);

								await Promise.all([this.updateGlobalState('currentApiConfigName', newName)]);

								await this.postStateToWebview();
							} catch (error) {
								console.error('Error create new api configuration:', error);
								vscode.window.showErrorMessage('Failed to create api configuration');
							}
						}
						break;
					case 'loadApiConfiguration':
						if (message.text) {
							try {
								const apiConfig = await this.configManager.loadConfig(message.text);
								const listApiConfig = await this.configManager.listConfig();

								await Promise.all([
									this.updateGlobalState('listApiConfigMeta', listApiConfig),
									this.updateGlobalState('currentApiConfigName', message.text),
									this.updateApiConfiguration(apiConfig),
								]);

								await this.postStateToWebview();
							} catch (error) {
								console.error('Error load api configuration:', error);
								vscode.window.showErrorMessage('Failed to load api configuration');
							}
						}
						break;
					case 'deleteApiConfiguration':
						if (message.text) {
							const answer = await vscode.window.showInformationMessage(
								'Are you sure you want to delete this configuration profile?',
								{ modal: true },
								'Yes',
							);

							if (answer !== 'Yes') {
								break;
							}

							try {
								await this.configManager.deleteConfig(message.text);
								const listApiConfig = await this.configManager.listConfig();

								// Update listApiConfigMeta first to ensure UI has latest data
								await this.updateGlobalState('listApiConfigMeta', listApiConfig);

								// If this was the current config, switch to first available
								const currentApiConfigName = await this.getGlobalState('currentApiConfigName');
								if (message.text === currentApiConfigName && listApiConfig?.[0]?.name) {
									const apiConfig = await this.configManager.loadConfig(listApiConfig[0].name);
									await Promise.all([
										this.updateGlobalState('currentApiConfigName', listApiConfig[0].name),
										this.updateApiConfiguration(apiConfig),
									]);
								}

								await this.postStateToWebview();
							} catch (error) {
								console.error('Error delete api configuration:', error);
								vscode.window.showErrorMessage('Failed to delete api configuration');
							}
						}
						break;
					case 'getListApiConfiguration':
						try {
							const listApiConfig = await this.configManager.listConfig();
							await this.updateGlobalState('listApiConfigMeta', listApiConfig);
							this.postMessageToWebview({ type: 'listApiConfig', listApiConfig });
						} catch (error) {
							console.error('Error get list api configuration:', error);
							vscode.window.showErrorMessage('Failed to get list api configuration');
						}
						break;
					case 'experimentalDiffStrategy':
						await this.updateGlobalState('experimentalDiffStrategy', message.bool ?? false);
						// Update diffStrategy in current Cline instance if it exists
						if (this.cline) {
							await this.cline.updateDiffStrategy(message.bool ?? false);
						}
						await this.postStateToWebview();
						break;
					case 'updateMcpTimeout':
						if (message.serverName && typeof message.timeout === 'number') {
							try {
								await this.mcpHub?.updateServerTimeout(message.serverName, message.timeout);
							} catch (error) {
								console.error(`Failed to update timeout for ${message.serverName}:`, error);
								vscode.window.showErrorMessage('Failed to update server timeout');
							}
						}
						break;
					case 'updateCustomMode':
						if (message.modeConfig) {
							await this.customModesManager.updateCustomMode(message.modeConfig.slug, message.modeConfig);
							// Update state after saving the mode
							const customModes = await this.customModesManager.getCustomModes();
							await this.updateGlobalState('customModes', customModes);
							await this.updateGlobalState('mode', message.modeConfig.slug);
							await this.postStateToWebview();
						}
						break;
					case 'deleteCustomMode':
						if (message.slug) {
							const answer = await vscode.window.showInformationMessage(
								'Are you sure you want to delete this custom mode?',
								{ modal: true },
								'Yes',
							);

							if (answer !== 'Yes') {
								break;
							}

							await this.customModesManager.deleteCustomMode(message.slug);
							// Switch back to default mode after deletion
							await this.updateGlobalState('mode', defaultModeSlug);
							await this.postStateToWebview();
						}
						break;
					case 'answer':
						this.cline?.receiveAnswer(message.payload);
						break;
					case 'userApproval':
						this.cline?.receiveApproval(message.payload);
						break;
					case 'setAllowedTools':
						this.setAllowedTools(message.toolId!);
						break;
				}
			},
			null,
			this.disposables,
		);
	}
	private async setAllowedTools(toolId: string| string[]) {
		const newCommands = this.allowedToolTree.setAllowedTools(toolId);

		await this.globalState.set('allowedCommands', newCommands);
		this.postMessageToWebview({
			type: 'allowedTools',
			allowedTools: newCommands
		});
	}

	/**
	 * Handle switching to a new mode, including updating the associated API configuration
	 * @param newMode The mode to switch to
	 */
	public async handleModeSwitch(newMode: Mode) {
		await this.updateGlobalState('mode', newMode);

		// Load the saved API config for the new mode if it exists
		const savedConfigId = await this.configManager.getModeConfigId(newMode);
		const listApiConfig = await this.configManager.listConfig();

		// Update listApiConfigMeta first to ensure UI has latest data
		await this.updateGlobalState('listApiConfigMeta', listApiConfig);

		// If this mode has a saved config, use it
		if (savedConfigId) {
			const config = listApiConfig?.find((c) => c.id === savedConfigId);
			if (config?.name) {
				const apiConfig = await this.configManager.loadConfig(config.name);
				await Promise.all([
					this.updateGlobalState('currentApiConfigName', config.name),
					this.updateApiConfiguration(apiConfig),
				]);
			}
		} else {
			// If no saved config for this mode, save current config as default
			const currentApiConfigName = await this.getGlobalState('currentApiConfigName');
			if (currentApiConfigName) {
				const config = listApiConfig?.find((c) => c.name === currentApiConfigName);
				if (config?.id) {
					await this.configManager.setModeConfig(newMode, config.id);
				}
			}
		}

		await this.postStateToWebview();
	}

	private async updateApiConfiguration(apiConfiguration: ApiConfiguration) {
		// Update mode's default config
		const { mode } = await this.getState();
		if (mode) {
			const currentApiConfigName = await this.getGlobalState('currentApiConfigName');
			const listApiConfig = await this.configManager.listConfig();
			const config = listApiConfig?.find((c) => c.name === currentApiConfigName);
			if (config?.id) {
				await this.configManager.setModeConfig(mode, config.id);
			}
		}

		await this.configService.updateApiConfig(apiConfiguration);

		if (this.cline) {
			this.cline.api = buildApiHandler(apiConfiguration);
		}
	}

	async updateCustomInstructions(instructions?: string) {
		// User may be clearing the field
		await this.updateGlobalState('customInstructions', instructions || undefined);
		if (this.cline) {
			this.cline.customInstructions = instructions || undefined;
		}
		await this.postStateToWebview();
	}


	// VSCode LM API
	private async getVsCodeLmModels() {
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
		const history = ((await this.getGlobalState('taskHistory')) as HistoryItem[] | undefined) || [];
		const historyItem = history.find((item) => item.id === id);
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, 'tasks', id);
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
			await this.clearTask();
			const { historyItem } = await this.getTaskWithId(id);
			await this.createCline({historyItem});
			await this.postStateToWebview();
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
		const taskHistory = ((await this.getGlobalState('taskHistory')) as HistoryItem[]) || [];
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id);
		await this.updateGlobalState('taskHistory', updatedTaskHistory);

		// Notify the webview that the task has been deleted
		await this.postStateToWebview();
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview();
		// @ts-ignore
		this.postMessageToWebview({ type: 'state', state });
	}

	async getStateToPostToWebview() {
		const state = await this.getState();
		const { taskHistory, lastShownAnnouncementId, ...restState } = state;
		return {
			version: this.context.extension?.packageJSON?.version ?? '',
			uriScheme: vscode.env.uriScheme,
			clineMessages: this.cline?.clineMessages || [],
			taskHistory: (taskHistory || [])
				.filter((item: HistoryItem) => item.ts && item.task)
				.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts),
			shouldShowAnnouncement: lastShownAnnouncementId !== this.latestAnnouncementId,
			customModes: await this.customModesManager.getCustomModes(),
			...restState
		};
	}

	async clearTask() {
		this.cline?.abortTask();
		this.cline = undefined; // removes reference to it, so once promises end it will be garbage collected
	}

	async getState() {
		return await this.configService.getConfig();
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		return await this.globalState.updateTaskHistory(item);
	}

	// global

	async updateGlobalState(key: GlobalStateKey, value: unknown) {
		await this.globalState.set(key, value);
	}

	async getGlobalState(key: GlobalStateKey) {
		return await this.globalState.get(key);
	}

	// secrets

	private async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this.configService.storeSecret(key, value);
		} else {
			await this.configService.deleteSecret(key);
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

		for (const key in this.globalState.keys()) {
			await this.globalState.set(key, undefined);
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
		await this.configManager.resetAllConfigs();
		await this.customModesManager.resetCustomModes();
		if (this.cline) {
			this.cline.abortTask();
			this.cline = undefined;
		}
		await this.postStateToWebview();
		await this.postMessageToWebview({ type: 'action', action: 'chatButtonClicked' });
	}
}
