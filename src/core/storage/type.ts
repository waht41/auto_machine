import { ApiConfiguration } from "@/shared/api";
import { SecretKey } from "@core/webview/type";

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
  "apiKey", "glamaApiKey", "openRouterApiKey", "awsAccessKey",
  "awsSecretKey", "awsSessionToken", "openAiApiKey", "geminiApiKey",
  "openAiNativeApiKey", "deepSeekApiKey", "mistralApiKey"
];

export type IGlobalState = {
  apiConfiguration: ApiConfiguration;
  lastShownAnnouncementId?: string;
  customInstructions?: string;
  alwaysAllowReadOnly?: boolean;
  alwaysAllowWrite?: boolean;
  alwaysAllowExecute?: boolean;
  alwaysAllowBrowser?: boolean;
  taskHistory?: any[];
  allowedCommands?: string[];
  soundEnabled?: boolean;
  soundVolume?: number;
  diffEnabled?: boolean;
  alwaysAllowMcp?: boolean;
  browserViewportSize?: string;
  screenshotQuality?: number;
  fuzzyMatchThreshold?: number;
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
  experimentalDiffStrategy: boolean;
  autoApprovalEnabled?: boolean;
  customModes?: any[];
  taskDirectory?: string;
}
