import { Anthropic } from '@anthropic-ai/sdk';

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
