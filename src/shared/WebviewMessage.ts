import { ApiConfiguration } from './api';
import { Mode, PromptComponent } from './modes';
import { SetTaskIdEvent } from '@/shared/ExtensionMessage';
import { AssistantStructure } from '@core/storage/type';

export type PromptMode = Mode | 'enhance'

export type AudioType = 'notification' | 'celebration' | 'progress_loop'

// Task related message types
export type NewTaskMessage = {
  type: 'newTask';
  text?: string;
  images?: string[];
  assistantName?: string;
}

export type ResumeTaskMessage = {
  type: 'resumeTask';
  text?: string;
  images?: string[];
}

export type ClearTaskMessage = {
  type: 'clearTask';
}

export type ShowTaskWithIdMessage = {
  type: 'showTaskWithId';
  text: string;
}

export type DeleteTaskWithIdMessage = {
  type: 'deleteTaskWithId';
  text: string;
}

export type ExportTaskWithIdMessage = {
  type: 'exportTaskWithId';
  text: string;
}

// Assistant related message types
export type GetAssistantsMessage = {
  type: 'getAssistants';
}

export type UpsertAssistantMessage = {
  type: 'upsertAssistant';
  assistant: AssistantStructure;
}

export type RemoveAssistantMessage = {
  type: 'removeAssistant';
  assistantName: string;
}

export type CancelTaskMessage = {
  type: 'cancelTask';
}

// API related message types
export type ApiConfigurationMessage = {
  type: 'apiConfiguration';
  apiConfiguration?: ApiConfiguration;
}



export type UpsertApiConfigurationMessage = {
  type: 'upsertApiConfiguration';
  text?: string;
  apiConfiguration?: ApiConfiguration;
}

export type AllowedCommandsMessage = { type: 'allowedCommands'; commands?: string[]; }
export type WebviewDidLaunchMessage = { type: 'webviewDidLaunch'; }

export type DidShowAnnouncementMessage = { type: 'didShowAnnouncement'; }
export type SelectImagesMessage = { type: 'selectImages'; }
export type ExportCurrentTaskMessage = { type: 'exportCurrentTask'; }
export type ResetStateMessage = { type: 'resetState'; }
export type RequestOllamaModelsMessage = { type: 'requestOllamaModels'; text?: string; }
export type RequestLmStudioModelsMessage = { type: 'requestLmStudioModels'; text?: string; }
export type OpenImageMessage = { type: 'openImage'; text?: string; }
export type OpenFileMessage = { type: 'openFile'; text?: string; }
export type OpenMentionMessage = { type: 'openMention'; text?: string; }
export type RefreshOpenRouterModelsMessage = { type: 'refreshOpenRouterModels'; }
export type RefreshOpenAiModelsMessage = { type: 'refreshOpenAiModels'; values?: Record<string, any>; }
export type AlwaysAllowMcpMessage = { type: 'alwaysAllowMcp'; bool?: boolean; }
export type PlaySoundMessage = { type: 'playSound'; audioType?: AudioType; }
export type SoundEnabledMessage = { type: 'soundEnabled'; bool?: boolean; }
export type SoundVolumeMessage = { type: 'soundVolume'; value?: number; }

export type BrowserViewportSizeMessage = { type: 'browserViewportSize'; values?: Record<string, any>; }
export type ScreenshotQualityMessage = { type: 'screenshotQuality'; value?: number; }
export type OpenMcpSettingsMessage = { type: 'openMcpSettings'; }
export type RestartMcpServerMessage = { type: 'restartMcpServer'; }
export type ToggleToolAlwaysAllowMessage = { type: 'toggleToolAlwaysAllow'; toolName?: string; alwaysAllow?: boolean; }
export type ToggleMcpServerMessage = { type: 'toggleMcpServer'; }
export type UpdateMcpTimeoutMessage = { type: 'updateMcpTimeout'; timeout?: number; }

export type PreferredLanguageMessage = { type: 'preferredLanguage'; text?: string; }
export type WriteDelayMsMessage = { type: 'writeDelayMs'; value?: number; }
export type EnhancePromptMessage = { type: 'enhancePrompt'; text?: string; }


export type DeleteMessageMessage = { type: 'deleteMessage'; text?: string; }
export type TerminalOutputLineLimitMessage = { type: 'terminalOutputLineLimit'; value?: number; }
export type McpEnabledMessage = { type: 'mcpEnabled'; bool?: boolean; }
export type SearchCommitsMessage = { type: 'searchCommits'; query?: string; }
export type RefreshGlamaModelsMessage = { type: 'refreshGlamaModels'; }
export type AlwaysApproveResubmitMessage = { type: 'alwaysApproveResubmit'; bool?: boolean; }
export type RequestDelaySecondsMessage = { type: 'requestDelaySeconds'; value?: number; }

export type RequestVsCodeLmModelsMessage = { type: 'requestVsCodeLmModels'; }

export type UpdatePromptMessage = { type: 'updatePrompt'; promptMode?: PromptMode; customPrompt?: PromptComponent; }
export type UpdateSupportPromptMessage = { type: 'updateSupportPrompt'; text?: string; values?: Record<string, any>; }
export type ResetSupportPromptMessage = { type: 'resetSupportPrompt'; text?: string; }
export type GetSystemPromptMessage = { type: 'getSystemPrompt'; mode?: Mode; }

export type EnhancementApiConfigIdMessage = { type: 'enhancementApiConfigId'; text?: string; }

export type AutoApprovalEnabledMessage = { type: 'autoApprovalEnabled'; bool?: boolean; }




export type AnswerMessage = { type: 'answer'; text?: string; }
export type UserApprovalMessage = { type: 'userApproval'; bool?: boolean; }
export type SetAllowedToolsMessage = { type: 'setAllowedTools'; toolId?: string | string[]; }

// Combine all message types into a union type
export type WebviewMessage =
  | CancelTaskMessage
  | NewTaskMessage
  | ResumeTaskMessage
  | ClearTaskMessage
  | ShowTaskWithIdMessage
  | UpsertApiConfigurationMessage
  | AllowedCommandsMessage
  | WebviewDidLaunchMessage
  | DidShowAnnouncementMessage
  | SelectImagesMessage
  | ExportCurrentTaskMessage
  | ResetStateMessage
  | RequestOllamaModelsMessage
  | RequestLmStudioModelsMessage
  | OpenImageMessage
  | OpenFileMessage
  | SoundVolumeMessage
  | BrowserViewportSizeMessage
  | ScreenshotQualityMessage
  | OpenMcpSettingsMessage
  | RestartMcpServerMessage
  | ToggleToolAlwaysAllowMessage
  | ToggleMcpServerMessage
  | UpdateMcpTimeoutMessage
  | PreferredLanguageMessage
  | WriteDelayMsMessage
  | EnhancePromptMessage
  | DeleteMessageMessage
  | TerminalOutputLineLimitMessage
  | McpEnabledMessage
  | SearchCommitsMessage
  | RefreshGlamaModelsMessage
  | AlwaysApproveResubmitMessage
  | RequestDelaySecondsMessage
  | RequestVsCodeLmModelsMessage
  | UpdatePromptMessage
  | UpdateSupportPromptMessage
  | ResetSupportPromptMessage
  | GetSystemPromptMessage
  | EnhancementApiConfigIdMessage
  | AutoApprovalEnabledMessage
  | AnswerMessage
  | UserApprovalMessage
  | SetAllowedToolsMessage
  | GetAssistantsMessage
  | UpsertAssistantMessage
  | RemoveAssistantMessage
  | SetTaskIdEvent;
