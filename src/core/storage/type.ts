import { ApiConfiguration, ModelInfo } from '@/shared/api';
import { SecretKey } from '@core/webview/type';

export type ISecret = {
  apiKey?: string;
  glamaApiKey?: string;
  openRouterApiKey?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsSessionToken?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  openAiNativeApiKey?: string;
  deepSeekApiKey?: string;
  mistralApiKey?: string;
}

export const secretKeys: SecretKey[] = [
	'apiKey', 'glamaApiKey', 'openRouterApiKey', 'awsAccessKey',
	'awsSecretKey', 'awsSessionToken', 'openAiApiKey', 'geminiApiKey',
	'openAiNativeApiKey', 'deepSeekApiKey', 'mistralApiKey'
];

export type IConfig = {
  apiConfiguration: ApiConfiguration;
  lastShownAnnouncementId?: string;
  customInstructions?: string;
  allowedCommands?: string[];
  soundEnabled?: boolean;
  soundVolume?: number;
  alwaysAllowMcp?: boolean;
  browserViewportSize?: string;
  screenshotQuality?: number;
  preferredLanguage?: string;
  writeDelayMs?: number;
  terminalOutputLineLimit?: number;
  mcpEnabled?: boolean;
  alwaysApproveResubmit?: boolean;
  requestDelaySeconds?: number;
  currentApiConfigName?: string;
  listApiConfigMeta?: any[];
  vsCodeLmModelSelector?: any;
  mode: string;
  modeApiConfigs?: Record<string, any>;
  customModePrompts?: Record<string, any>;
  customSupportPrompts?: Record<string, any>;
  enhancementApiConfigId?: string;
  autoApprovalEnabled?: boolean;
  customModes?: any[];
  taskDirRoot: string;
  openRouterModelInfo?: ModelInfo;
  glamaModelInfo?: ModelInfo;

}
