import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import pWaitFor from 'p-wait-for';
import * as path from 'path';
import * as vscode from 'vscode';
import { generateMarkdown } from '@/integrations/misc/export-markdown';
import { openFile, openImage } from '@/integrations/misc/open-file';
import { selectImages } from '@/integrations/misc/process-images';
import { getTheme } from '@/integrations/theme/getTheme';
import WorkspaceTracker from '../../integrations/workspace/WorkspaceTracker';
import { McpHub } from '@operation/MCP';
import { ApiConfiguration } from '@/shared/api';
import { findLast } from '@/shared/array';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { WebviewMessage } from '@/shared/WebviewMessage';
import { PromptComponent } from '@/shared/modes';
import { SYSTEM_PROMPT } from '../prompts/system';
import { fileExistsAtPath } from '@/utils/fs';
import { Cline } from '../Cline';
import { openMention } from '../mentions';
import { setSoundEnabled, setSoundVolume } from '@/utils/sound';
import { singleCompletionHandler } from '@/utils/single-completion-handler';
import { searchCommits } from '@/utils/git';
import { supportPrompt } from '@/shared/support-prompt';
import { configPath, createIfNotExists, getAssetPath } from '@core/storage/common';
import { ApprovalMiddleWrapper } from '@core/internal-implementation/middleware';
import { getToolCategory } from '@core/tool-adapter/getToolCategory';
import { AllowedToolTree } from '@core/tool-adapter/AllowedToolTree';
import { SecretKey } from '@core/webview/type';
import ApiProviderManager from '@core/manager/ApiProviderManager';
import { MessageService } from '@core/services/MessageService';
import { ConfigService } from '@core/services/ConfigService';
import { safeExecuteMiddleware } from '@executors/middleware';
import { GlobalFileNames } from '@core/webview/const';
import process from 'node:process';
import { IGlobalState } from '@core/storage/type';
import logger from '@/utils/logger';

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export class ClineProvider implements vscode.WebviewViewProvider {
	private static activeInstances: Set<ClineProvider> = new Set();
	private disposables: vscode.Disposable[] = [];
	private view?: vscode.WebviewView | vscode.WebviewPanel;
	private cline?: Cline;
	private workspaceTracker?: WorkspaceTracker;
	mcpHub?: McpHub;
	private latestAnnouncementId = 'jan-21-2025-custom-modes'; // update to some unique identifier when we add a new announcement
	private toolCategories = getToolCategory(path.join(getAssetPath(),'external-prompt'));
	private allowedToolTree = new AllowedToolTree([],this.toolCategories);
	private apiManager : ApiProviderManager;
	private readonly messageService : MessageService;
	private configService : ConfigService;

	constructor(
    private sendToMainProcess: (message: any) => void
	) {
		createIfNotExists(configPath);
		this.messageService = MessageService.getInstance(this.sendToMainProcess);
		this.apiManager = ApiProviderManager.getInstance(configPath, this.messageService);
		ClineProvider.activeInstances.add(this);
		this.workspaceTracker = new WorkspaceTracker(this);
		this.mcpHub = new McpHub(path.join(configPath,GlobalFileNames.mcpSettings),this.postMessageToWebview.bind(this));
		this.configService = ConfigService.getInstance();
	}

	async init() {
		await this.configService.init();
		await this.setUpAllowedTools();
		await this.mcpHub?.initialize();
	}

	public get globalState() { // todo waht 临时方案，待删
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
			taskDirRoot,
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
				middleWares: [safeExecuteMiddleware, ApprovalMiddleWrapper(this.allowedToolTree)],
				mcpHub: this.mcpHub,
				taskParentDir: taskDirRoot,
			}
		);
		await this.cline.init();
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
		const allowedTools = this.globalState.get('allowedCommands');
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
							await this.configService.updateApiConfig(message.apiConfiguration);
						}
						await this.postStateToWebview();
						break;
					case 'alwaysAllowMcp':
						await this.updateGlobalState('alwaysAllowMcp', message.bool);
						await this.postStateToWebview();
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
							await pWaitFor(() => this.cline === undefined || this.cline.abortComplete, {
								timeout: 3_000,
							}).catch(() => {
								console.error('Failed to abort task');
							});
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
						// if (message.audioType) {
						// 	const soundPath = path.join(this.context.extensionPath, 'audio', `${message.audioType}.wav`);
						// 	playSound(soundPath);
						// }
						//todo waht 考虑要不要加声音
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
								} = await this.getState();

								// Try to get enhancement config first, fall back to current config
								const configToUse: ApiConfiguration = apiConfiguration;
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
							const systemPrompt = await SYSTEM_PROMPT();

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
								await this.configService.updateApiConfig(message.apiConfiguration);
								await this.postStateToWebview();
							} catch (error) {
								console.error('Error create new api configuration:', error);
								vscode.window.showErrorMessage('Failed to create api configuration');
							}
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
		const history = this.configService.getTaskHistory();
		logger.debug('getTaskWithId history: ', history, 'id:',id);

		const historyItem = history.find((item) => item.id === id);
		if (historyItem) {
			const taskDirRoot: string = this.globalState.get('taskDirRoot');
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
		await this.configService.deleteTaskHistory(id);

		// Notify the webview that the task has been deleted
		await this.postStateToWebview();
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview();
		// @ts-ignore
		await this.postMessageToWebview({ type: 'state', state });
	}

	async getStateToPostToWebview() {
		const state = await this.getState();
		const { lastShownAnnouncementId, ...restState } = state;
		const taskHistory = this.configService.getTaskHistory();
		return {
			version: process.env?.version ?? '',
			uriScheme: vscode.env.uriScheme,
			clineMessages: this.cline?.clineMessages || [],
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
		return await this.configService.getConfig();
	}

	async updateTaskHistory(item: HistoryItem) {
		await this.configService.addTaskHistory(item);
	}

	// global

	async updateGlobalState(key: keyof IGlobalState, value: unknown) {
		await this.globalState.set(key, value);
	}

	async getGlobalState<T extends keyof IGlobalState>(key: T)  {
		return this.globalState.get(key);
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
			await this.globalState.set(key as keyof IGlobalState, undefined);
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
