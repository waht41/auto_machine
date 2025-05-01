import * as yaml from 'js-yaml';
import Browser from '@operation/Browser';
import File from '@operation/File';
import { BrowserCommand, IInternalContext } from '@core/internal-implementation/type';

/**
 * 处理长分析结果，如果超过指定长度则截断并添加提示信息
 * @param data 需要处理的数据
 * @param maxLength 最大长度限制，默认为5000字符
 * @returns 处理后的YAML格式字符串
 */
export const handleLongAnalyzeResult = (data: any, maxLength: number = 5000): string => {
	// 将数据转换为YAML格式
	const yamlString = yaml.dump(data);
    
	// 检查结果长度是否超过限制
	if (yamlString.length <= maxLength) {
		return yamlString;
	}
    
	// 截取前maxLength个字符
	const truncatedYaml = yamlString.substring(0, maxLength);
    
	// 计算剩余未显示的字符数
	const remainingChars = yamlString.length - maxLength;
    
	// 添加提示信息
	const message = `\n\n... (${remainingChars} characters not shown. The result was truncated due to its large size.)`;
    
	return truncatedYaml + message;
};

/**
 * 处理浏览器下载命令
 * @param command 下载命令
 * @param context 内部上下文
 * @returns 下载完成消息
 */
export async function handleDownloadCommand(command: BrowserCommand & { cmd: 'download' }, context: IInternalContext): Promise<string> {
	const { cline } = context;
	let partial = true;
	const messageId = cline.getNewMessageId();

	if (command.selector || command.tag || command.id || command.text) {
		// 使用浏览器下载
		for await (const progress of Browser.browserDownload(command)) {
			if (progress.status === 'completed'){
				partial = false;
			}
			await cline?.sayP({ sayType:'tool', text: JSON.stringify({...command,...progress}), partial, messageId });
		}
	} else {
		// 使用文件下载
		for await (const progress of File.download({ path:'./download',...command })) {
			if (progress.status === 'completed'){
				partial = false;
			}
			await cline?.sayP({ sayType:'tool', text: JSON.stringify({...command,...progress}), partial, messageId });
		}
	}
    
	return `Download ${command.url} to ${command.path ?? 'default path'} completed`;
}
