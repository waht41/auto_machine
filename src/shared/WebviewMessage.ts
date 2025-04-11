import { ApiConfiguration } from './api';
import { Mode, PromptComponent, ModeConfig } from './modes';
import { SetTaskIdEvent } from '@/shared/ExtensionMessage';

export type PromptMode = Mode | 'enhance'

export type AudioType = 'notification' | 'celebration' | 'progress_loop'

export type WebviewMessage = {
	type:
		| 'apiConfiguration'
		| 'currentApiConfigName'
		| 'upsertApiConfiguration'
		| 'deleteApiConfiguration'
		| 'loadApiConfiguration'
		| 'renameApiConfiguration'
		| 'getListApiConfiguration'
		| 'customInstructions'
		| 'allowedCommands'
		| 'webviewDidLaunch'
		| 'newTask'
		| 'askResponse'
		| 'clearTask'
		| 'didShowAnnouncement'
		| 'selectImages'
		| 'exportCurrentTask'
		| 'showTaskWithId'
		| 'deleteTaskWithId'
		| 'exportTaskWithId'
		| 'resetState'
		| 'requestOllamaModels'
		| 'requestLmStudioModels'
		| 'openImage'
		| 'openFile'
		| 'openMention'
		| 'cancelTask'
		| 'refreshOpenRouterModels'
		| 'refreshOpenAiModels'
		| 'alwaysAllowMcp'
		| 'playSound'
		| 'soundEnabled'
		| 'soundVolume'
		| 'diffEnabled'
		| 'browserViewportSize'
		| 'screenshotQuality'
		| 'openMcpSettings'
		| 'restartMcpServer'
		| 'toggleToolAlwaysAllow'
		| 'toggleMcpServer'
		| 'updateMcpTimeout'
		| 'fuzzyMatchThreshold'
		| 'preferredLanguage'
		| 'writeDelayMs'
		| 'enhancePrompt'
		| 'enhancedPrompt'
		| 'draggedImages'
		| 'deleteMessage'
		| 'terminalOutputLineLimit'
		| 'mcpEnabled'
		| 'searchCommits'
		| 'refreshGlamaModels'
		| 'alwaysApproveResubmit'
		| 'requestDelaySeconds'
		| 'setApiConfigPassword'
		| 'requestVsCodeLmModels'
		| 'mode'
		| 'updatePrompt'
		| 'updateSupportPrompt'
		| 'resetSupportPrompt'
		| 'getSystemPrompt'
		| 'systemPrompt'
		| 'enhancementApiConfigId'
		| 'experimentalDiffStrategy'
		| 'autoApprovalEnabled'
		| 'updateCustomMode'
		| 'deleteCustomMode'
		| 'setopenAiCustomModelInfo'
		| 'openCustomModesSettings'
		| 'resumeTask'
    | 'answer'
    | 'userApproval'
		| 'setAllowedTools'
	text?: string
	disabled?: boolean
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	value?: number
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	mode?: Mode
	promptMode?: PromptMode
	customPrompt?: PromptComponent
	dataUrls?: string[]
	values?: Record<string, any>
	query?: string
	slug?: string
	modeConfig?: ModeConfig
	timeout?: number
	payload?: any
	toolId?: string | string[]
} | SetTaskIdEvent;

export type ClineAskResponse = 'yesButtonClicked' | 'noButtonClicked' | 'messageResponse'
