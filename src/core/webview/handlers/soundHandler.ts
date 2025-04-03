import { WebviewMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import { setSoundEnabled, setSoundVolume } from '@/utils/sound';

export const soundHandlers = {
	'playSound': handlePlaySound,
	'soundEnabled': handleSoundEnabled,
	'soundVolume': handleSoundVolume,
};

/**
 * 播放声音
 * 注：目前此功能已被注释，待确定是否需要添加声音功能
 */
export async function handlePlaySound() {
	// if (message.audioType) {
	//     const soundPath = path.join(instance.context.extensionPath, 'audio', `${message.audioType}.wav`);
	//     playSound(soundPath);
	// }
	//todo waht 考虑要不要加声音
}

/**
 * 设置声音启用状态
 */
export async function handleSoundEnabled(instance: ClineProvider, message: WebviewMessage) {
	const soundEnabled = message.bool ?? true;
	await instance.updateConfig('soundEnabled', soundEnabled);
	setSoundEnabled(soundEnabled); // 更新声音工具的状态
	await instance.postStateToWebview();
}

/**
 * 设置声音音量
 */
export async function handleSoundVolume(instance: ClineProvider, message: WebviewMessage) {
	const soundVolume = message.value ?? 0.5;
	await instance.updateConfig('soundVolume', soundVolume);
	setSoundVolume(soundVolume);
	await instance.postStateToWebview();
}
