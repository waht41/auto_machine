import {
	AlwaysApproveResubmitMessage,
	AutoApprovalEnabledMessage,
	BrowserViewportSizeMessage,
	EnhancementApiConfigIdMessage,
	PreferredLanguageMessage,
	RequestDelaySecondsMessage,
	ScreenshotQualityMessage,
	TerminalOutputLineLimitMessage,
	WriteDelayMsMessage
} from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import { IConfig } from '@core/storage/type';

// 定义支持的状态更新类型和对应的处理函数
interface StateUpdateConfig {
    stateKey: keyof IConfig;
    valueKey: 'text' | 'value' | 'bool';
    defaultValue?: unknown;
}

// 配置不同消息类型对应的状态更新配置
const stateUpdateConfigs: Record<string, StateUpdateConfig> = {
	'preferredLanguage': { stateKey: 'preferredLanguage', valueKey: 'text' },
	'writeDelayMs': { stateKey: 'writeDelayMs', valueKey: 'value' },
	'terminalOutputLineLimit': { stateKey: 'terminalOutputLineLimit', valueKey: 'value' },
	'screenshotQuality': { stateKey: 'screenshotQuality', valueKey: 'value' },
	'enhancementApiConfigId': { stateKey: 'enhancementApiConfigId', valueKey: 'text' },
	'autoApprovalEnabled': { stateKey: 'autoApprovalEnabled', valueKey: 'bool', defaultValue: false },
	'alwaysApproveResubmit': { stateKey: 'alwaysApproveResubmit', valueKey: 'bool', defaultValue: false },
	'requestDelaySeconds': { stateKey: 'requestDelaySeconds', valueKey: 'value', defaultValue: 5 },
	'browserViewportSize': { stateKey: 'browserViewportSize', valueKey: 'text', defaultValue: '900x600' },
};

// 定义状态消息类型的联合类型
type StateMessage =
  | PreferredLanguageMessage
  | WriteDelayMsMessage
  | TerminalOutputLineLimitMessage
  | ScreenshotQualityMessage
  | EnhancementApiConfigIdMessage
  | AutoApprovalEnabledMessage
  | AlwaysApproveResubmitMessage
  | RequestDelaySecondsMessage
  | BrowserViewportSizeMessage;

// 通用的状态更新处理函数
export async function handleStateUpdate(instance: ClineProvider, message: StateMessage) {
	const config = stateUpdateConfigs[message.type];
	if (!config) return;

	let value;
	if (config.valueKey === 'bool') {
		// 使用类型断言来处理不同的消息类型
		const boolMessage = message as { bool?: boolean };
		value = boolMessage.bool ?? config.defaultValue;
	} else if (config.valueKey === 'value') {
		// 使用类型断言来处理不同的消息类型
		const valueMessage = message as { value?: number };
		value = valueMessage.value ?? config.defaultValue;
	} else {
		// 使用类型断言来处理不同的消息类型
		const textMessage = message as { text?: string };
		value = textMessage.text ?? config.defaultValue;
	}

	await instance.updateConfig(config.stateKey, value);
	await instance.postStateToWebview();
}

/**
 * 重置所有状态
 */
export async function handleResetState(instance: ClineProvider) {
	await instance.resetState();
}

// 导出所有支持的状态更新处理器
export const stateHandlers = {
	preferredLanguage: handleStateUpdate,
	writeDelayMs: handleStateUpdate,
	terminalOutputLineLimit: handleStateUpdate,
	screenshotQuality: handleStateUpdate,
	enhancementApiConfigId: handleStateUpdate,
	autoApprovalEnabled: handleStateUpdate,
	alwaysApproveResubmit: handleStateUpdate,
	requestDelaySeconds: handleStateUpdate,
	browserViewportSize: handleStateUpdate,
	resetState: handleResetState
};
