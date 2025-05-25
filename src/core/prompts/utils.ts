import { Anthropic } from '@anthropic-ai/sdk';
import { getPromptPath } from '@core/storage/common';
import fs from 'fs';
import path from 'path';

export type UserContent = Array<
    TextBlockParam | ImageBlockParam | ToolUseBlockParam | ToolResultBlockParam
>

export interface TextBlockParam {
	text: string;

	type: 'text';
}


export interface ImageBlockParam {
	source: Source;

	type: 'image';
}

export interface Source {
	data: string;

	media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

	type: 'base64';
}

export interface ToolUseBlockParam {
	id: string;

	input: unknown;

	name: string;

	type: 'tool_use';
}

export interface ToolResultBlockParam {
	tool_use_id: string;

	type: 'tool_result';

	content?: string | Array<TextBlockParam | ImageBlockParam>;

	is_error?: boolean;
}




export const formatImagesIntoBlocks = (images?: string[]): ImageBlockParam[] => {
	return images
		? images.map((dataUrl) => {
			// data:image/png;base64,base64string
			const [rest, base64] = dataUrl.split(',');
			const mimeType = rest.split(':')[1].split(';')[0];
			return {
				type: 'image',
				source: { type: 'base64', media_type: mimeType, data: base64 },
			} as Anthropic.ImageBlockParam;
		})
		: [];
};

export function toUserContent(text?: string, images?: string[]): UserContent {
	const userContent: UserContent = [];
	if (text) {
		userContent.push({ type: 'text', text });
	}
	if (images) {
		const imageBlocks = formatImagesIntoBlocks(images);
		userContent.push(...imageBlocks);
	}
	return userContent;
}

export const convertUserContentString = async (block: UserContent, convert: (string: string) => Promise<string> | string, condition?: (string: string) => boolean) => {
	const shouldConvert =(text:string) =>{
		return condition? condition(text): true;
	};
	return await Promise.all(block.map(async (item) => {
		// For TextBlockParam
		if (item.type === 'text') {
			if (shouldConvert(item.text)) {
				return {
					...item,
					text: await convert(item.text)
				};
			}
			return item;
		}

		// For ToolResultBlockParam with string content
		if (item.type === 'tool_result' && typeof item.content === 'string') {
			if (shouldConvert(item.content)) {
				return {
					...item,
					content: await convert(item.content)
				};
			}
			return item;
		}

		// For ToolResultBlockParam with array content
		if (item.type === 'tool_result' && Array.isArray(item.content)) {
			const processedContent = await Promise.all(item.content.map(async (contentItem) => {
				if (contentItem.type === 'text' && shouldConvert(contentItem.text)) {
					return {
						...contentItem,
						text: await convert(contentItem.text)
					};
				}
				return contentItem;
			}));

			return {
				...item,
				content: processedContent
			};
		}

		return item;
	}));
};

type InternalPrompt = {
	name: string;
	description: string;
	content: string;
}

/**
 * Read YAML files from a directory and extract prompts
 */
const readPromptDir = (dirPath: string, namePrefix: string = ''): InternalPrompt[] => {
	const prompts: InternalPrompt[] = [];
	if (!fs.existsSync(dirPath)) return prompts;

	const files = fs.readdirSync(dirPath);
	for (const file of files) {
		if (file.endsWith('.yaml')) {
			const filePath = path.join(dirPath, file);
			const content = fs.readFileSync(filePath, 'utf8');
			const firstLine = content.split('\n')[0].trim();
			const description = firstLine.startsWith('#') ? firstLine.substring(1).trim() : firstLine;
			const baseName = path.basename(file, '.yaml');
			const name = namePrefix ? `${namePrefix}/${baseName}` : baseName;

			prompts.push({
				name,
				description,
				content
			});
		}
	}
	return prompts;
};

const prompts: InternalPrompt[] = [];

export const getInternalPrompt = async (): Promise<InternalPrompt[]> => {
	if (prompts.length !==0 ){
		return prompts;
	}

	try {
		// Read base.md file
		const promptDirPath = getPromptPath();
		const basePath = path.join(promptDirPath, 'base.md');
		if (fs.existsSync(basePath)) {
			const baseContent = fs.readFileSync(basePath, 'utf8');
			prompts.push({
				name: 'base',
				description: 'This is auto machine\'s default Prompt',
				content: baseContent
			});
		}

		// Read external-prompt directory
		const externalPromptDir = path.join(promptDirPath, 'external-prompt');
		prompts.push(...readPromptDir(externalPromptDir));

		// Read trigger directory
		const triggerDir = path.join(promptDirPath, 'trigger');
		prompts.push(...readPromptDir(triggerDir, 'trigger'));

		return prompts;
	} catch (error) {
		console.error('Error reading prompt files:', error);
		return [];
	}
};
