import { OpenFileMessage, OpenImageMessage, OpenMentionMessage } from '@/shared/WebviewMessage';
import { type ClineProvider } from '@core/webview/ClineProvider';
import { selectImages } from '@/integrations/misc/process-images';
import { openFile, openImage } from '@/integrations/misc/open-file';
import { openMention } from '@core/mentions';

export const fileHandlers = {
	'selectImages': handleSelectImages,
	'exportCurrentTask': handleExportCurrentTask,
	'openImage': handleOpenImage,
	'openFile': handleOpenFile,
	'openMention': handleOpenMention,
};

/**
 * 处理选择图像
 */
export async function handleSelectImages(instance: ClineProvider) {
	const images = await selectImages();
	await instance.messageService.postMessageToWebview({ type: 'selectedImages', images });
}

/**
 * 导出当前任务
 */
export async function handleExportCurrentTask(instance: ClineProvider) {
	const currentTaskId = instance.cline?.taskId;
	if (currentTaskId) {
		await instance.exportTaskWithId(currentTaskId);
	}
}

/**
 * 打开图像
 */
export async function handleOpenImage(instance: ClineProvider, message: OpenImageMessage) {
	openImage(message.text!);
}

/**
 * 打开文件
 */
export async function handleOpenFile(instance: ClineProvider, message: OpenFileMessage) {
	openFile(message.text!, message.values as { create?: boolean; content?: string });
}

/**
 * 打开提及
 */
export async function handleOpenMention(instance: ClineProvider, message: OpenMentionMessage) {
	openMention(message.text);
}
