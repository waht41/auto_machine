// type that represents json data that is sent from extension to webview, called ExtensionMessage and has 'type' enum which can be 'plusButtonClicked' or 'settingsButtonClicked' or 'hello'

import { ApiConfiguration, ApiProvider, ModelInfo } from './api';
import { HistoryItem } from './HistoryItem';
import { McpServer } from './mcp';
import { GitCommit } from '@/utils/git';
import { CustomModePrompts, Mode, ModeConfig } from './modes';
import { CustomSupportPrompts } from './support-prompt';
import { IToolCategory } from '@core/tool-adapter/type';

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}

// webview will hold state
export interface ExtensionMessage {
	type:
		| 'action'
		| 'state'
		| 'selectedImages'
		| 'ollamaModels'
		| 'lmStudioModels'
		| 'theme'
		| 'workspaceUpdated'
		| 'invoke'
		| 'partialMessage'
		| 'glamaModels'
		| 'openRouterModels'
		| 'openAiModels'
		| 'mcpServers'
		| 'enhancedPrompt'
		| 'commitSearchResults'
		| 'listApiConfig'
		| 'vsCodeLmModels'
		| 'vsCodeLmApiAvailable'
		| 'requestVsCodeLmModels'
		| 'updatePrompt'
		| 'systemPrompt'
		| 'autoApprovalEnabled'
		| 'updateCustomMode'
		| 'deleteCustomMode'
		| 'toolCategories'
		| 'allowedTools'
    | 'electron'
	text?: string
	action?:
		| 'chatButtonClicked'
		| 'mcpButtonClicked'
		| 'settingsButtonClicked'
		| 'historyButtonClicked'
		| 'promptsButtonClicked'
		| 'didBecomeVisible'
	invoke?: 'sendMessage' | 'primaryButtonClick' | 'secondaryButtonClick'
	state?: ExtensionState
	images?: string[]
	ollamaModels?: string[]
	lmStudioModels?: string[]
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	filePaths?: string[]
	partialMessage?: ClineMessage
	glamaModels?: Record<string, ModelInfo>
	openRouterModels?: Record<string, ModelInfo>
	openAiModels?: string[]
	mcpServers?: McpServer[]
	commits?: GitCommit[]
	listApiConfig?: ApiConfigMeta[]
	mode?: Mode
	customMode?: ModeConfig
	slug?: string
	toolCategories?: IToolCategory[]
	allowedTools?: string[]
  payload?: any
}

export interface ApiConfigMeta {
	id: string
	name: string
	apiProvider?: ApiProvider
}

export interface ExtensionState {
	version: string
	taskHistory: HistoryItem[]
	shouldShowAnnouncement: boolean
	apiConfiguration?: ApiConfiguration
	currentApiConfigName?: string
	listApiConfigMeta?: ApiConfigMeta[]
	customInstructions?: string
	customModePrompts?: CustomModePrompts
	customSupportPrompts?: CustomSupportPrompts
	alwaysAllowMcp?: boolean
	alwaysApproveResubmit?: boolean
	requestDelaySeconds: number
	uriScheme?: string
	allowedCommands?: string[]
	soundEnabled?: boolean
	soundVolume?: number
	diffEnabled?: boolean
	browserViewportSize?: string
	screenshotQuality?: number
	fuzzyMatchThreshold?: number
	preferredLanguage: string
	writeDelayMs: number
	terminalOutputLineLimit?: number
	mcpEnabled: boolean
	mode: Mode
	modeApiConfigs?: Record<Mode, string>
	enhancementApiConfigId?: string
	experimentalDiffStrategy?: boolean
	autoApprovalEnabled?: boolean
	customModes: ModeConfig[]
	toolRequirements?: Record<string, boolean> // Map of tool names to their requirements (e.g. {"apply_diff": true} if diffEnabled)
	toolCategories?: IToolCategory[]
	allowedTools?: string[]
}

export interface ClineMessage {
	ts: number
	type: 'ask' | 'say'
	ask?: ClineAsk
	say?: ClineSay
	text?: string
	images?: string[]
	partial?: boolean
	reasoning?: string
	messageId?: number
}

export type ClineAsk =
	| 'followup'
	| 'completion_result'
	| 'tool'
	| 'api_req_failed'
	| 'resume_task'
	| 'resume_completed_task'
	| 'mistake_limit_reached'
	| 'use_mcp_server'

export type ClineSay =
	| 'task'
	| 'error'
	| 'api_req_started'
	| 'text'
	| 'reasoning'
	| 'completion_result'
	| 'user_feedback'
	| 'tool'
	| 'command'
	| 'plan'
	| 'agent_stream'

export interface ClineSayTool {
	tool: ''
	path?: string
	diff?: string
	content?: string
	regex?: string
	filePattern?: string
	mode?: string
	reason?: string
}

// must keep in sync with system prompt
export const browserActions = ['launch', 'click', 'type', 'scroll_down', 'scroll_up', 'close'] as const;
export type BrowserAction = (typeof browserActions)[number]

export interface ClineSayBrowserAction {
	action: BrowserAction
	coordinate?: string
	text?: string
}

export type BrowserActionResult = {
	screenshot?: string
	logs?: string
	currentUrl?: string
	currentMousePosition?: string
}

export interface ClineAskUseMcpServer {
	serverName: string
	type: 'use_mcp_tool' | 'access_mcp_resource'
	toolName?: string
	arguments?: string
	uri?: string
}

export interface ClineApiReqInfo {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	cancelReason?: ClineApiReqCancelReason
	streamingFailedMessage?: string
}

export type ClineApiReqCancelReason = 'streaming_failed' | 'user_cancelled'
