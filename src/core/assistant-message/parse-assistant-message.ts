import {
	AssistantMessageContent,
	TextContent,
} from '.';
import * as yaml from 'js-yaml';

interface BlockParseResult {
	content: AssistantMessageContent | AssistantMessageContent[];
	nextPosition: number;
}

export function parseBlocks(str: string): AssistantMessageContent[] {
	const blocks: AssistantMessageContent[] = [];
	let currentPos = 0;

	while (currentPos < str.length) {
		const blockStart = str.indexOf('```', currentPos);

		if (blockStart === -1) {
			const remainingText = str.slice(currentPos).trim();
			if (remainingText.length > 0) {
				blocks.push(createTextBlock(remainingText, true));
			}
			break;
		}

		// 处理代码块前的文本
		const beforeText = str.slice(currentPos, blockStart).trim();
		if (beforeText.length > 0) {
			blocks.push(createTextBlock(beforeText, false));
		}

		// 解析代码块
		const result = parseCodeBlock(str, blockStart);
		if (Array.isArray(result.content)) {
			blocks.push(...result.content);
		} else {
			blocks.push(result.content);
		}
		currentPos = result.nextPosition;
	}

	return blocks;
}

function parseCodeBlock(str: string, startPos: number): BlockParseResult {
	const nextNewline = str.indexOf('\n', startPos);
	const isYamlBlock = nextNewline !== -1 &&
		str.slice(startPos, nextNewline).trim() === '```yaml';

	if (isYamlBlock) {
		return parseYamlBlock(str, nextNewline);
	} else {
		return parseRegularCodeBlock(str, startPos);
	}
}

function parseYamlBlock(str: string, startNewline: number): BlockParseResult {
	const endMarker = '```';
	const endIndex = str.indexOf(endMarker, startNewline);

	if (endIndex === -1) {
		return {
			content: createTextBlock(str.slice(startNewline), true),
			nextPosition: str.length
		};
	}

	const yamlContent = str.slice(startNewline + 1, endIndex);
	const content = parseYamlContent(yamlContent);

	return {
		content,
		nextPosition: endIndex + endMarker.length
	};
}

function parseYamlContent(yamlContent: string): AssistantMessageContent | AssistantMessageContent[] {
	try {
		const parsed = yaml.load(yamlContent) as any;
		if (Array.isArray(parsed)) {
			const toolBlocks = parsed.map(toolData => {
				if (toolData?.tool) {
					return {
						type: 'tool_use',
						name: toolData.tool,
						params: extractToolParams(toolData),
						partial: false
					} satisfies AssistantMessageContent;
				}
				return null;
			}).filter(block => block !== null) as AssistantMessageContent[];

			if (toolBlocks.length > 0) {
				return toolBlocks;
			}
		} else if (parsed?.tool) {
			return {
				type: 'tool_use',
				name: parsed.tool,
				params: extractToolParams(parsed),
				partial: false
			};
		}
	} catch {
		console.error('YAML 解析失败:', yamlContent);
		// YAML 解析失败时作为普通文本处理
	}

	return createTextBlock(yamlContent, false);
}

function extractToolParams(toolData: any): Record<string, any> {
	return Object.fromEntries(
		Object.entries(toolData).filter(([key]) => key !== 'tool')
	);
}

function parseRegularCodeBlock(str: string, startPos: number): BlockParseResult {
	const endMarker = '```';
	const endIndex = str.indexOf(endMarker, startPos + 3);

	if (endIndex === -1) {
		return {
			content: createTextBlock(str.slice(startPos), true),
			nextPosition: str.length
		};
	}

	return {
		content: createTextBlock(str.slice(startPos, endIndex + endMarker.length), false),
		nextPosition: endIndex + endMarker.length
	};
}

function createTextBlock(content: string, partial: boolean): TextContent {
	return {
		type: 'text',
		content: content.trim(),
		partial
	};
}

