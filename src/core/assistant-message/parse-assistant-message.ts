import {
	AssistantMessageContent,
	TextContent,
	ToolUse,
	ToolParamName,
	toolParamNames,
	toolUseNames,
	ToolUseName,
} from "."
import * as yaml from 'js-yaml';

export function parseAssistantMessage(assistantMessage: string) {
	let contentBlocks: AssistantMessageContent[] = []
	let currentTextContent: TextContent | undefined = undefined
	let currentTextContentStartIndex = 0
	let currentToolUse: ToolUse | undefined = undefined
	let currentToolUseStartIndex = 0
	let currentParamName: ToolParamName | undefined = undefined
	let currentParamValueStartIndex = 0
	let accumulator = ""

	for (let i = 0; i < assistantMessage.length; i++) {
		const char = assistantMessage[i]
		accumulator += char

		// there should not be a param without a tool use
		if (currentToolUse && currentParamName) {
			const currentParamValue = accumulator.slice(currentParamValueStartIndex)
			const paramClosingTag = `</${currentParamName}>`
			if (currentParamValue.endsWith(paramClosingTag)) {
				// end of param value
				currentToolUse.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim()
				currentParamName = undefined
				continue
			} else {
				// partial param value is accumulating
				continue
			}
		}

		// no currentParamName

		if (currentToolUse) {
			const currentToolValue = accumulator.slice(currentToolUseStartIndex)
			const toolUseClosingTag = `</${currentToolUse.name}>`
			if (currentToolValue.endsWith(toolUseClosingTag)) {
				// end of a tool use
				currentToolUse.partial = false
				contentBlocks.push(currentToolUse)
				currentToolUse = undefined
				continue
			} else {
				const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
				for (const paramOpeningTag of possibleParamOpeningTags) {
					if (accumulator.endsWith(paramOpeningTag)) {
						// start of a new parameter
						currentParamName = paramOpeningTag.slice(1, -1) as ToolParamName
						currentParamValueStartIndex = accumulator.length
						break
					}
				}

				// there's no current param, and not starting a new param

				// special case for write_to_file where file contents could contain the closing tag, in which case the param would have closed and we end up with the rest of the file contents here. To work around this, we get the string between the starting content tag and the LAST content tag.
				const contentParamName: ToolParamName = "content"
				if (currentToolUse.name === "write_to_file" && accumulator.endsWith(`</${contentParamName}>`)) {
					const toolContent = accumulator.slice(currentToolUseStartIndex)
					const contentStartTag = `<${contentParamName}>`
					const contentEndTag = `</${contentParamName}>`
					const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
					const contentEndIndex = toolContent.lastIndexOf(contentEndTag)
					if (contentStartIndex !== -1 && contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
						currentToolUse.params[contentParamName] = toolContent
							.slice(contentStartIndex, contentEndIndex)
							.trim()
					}
				}

				// partial tool value is accumulating
				continue
			}
		}

		// no currentToolUse

		let didStartToolUse = false
		const possibleToolUseOpeningTags = toolUseNames.map((name) => `<${name}>`)
		for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
			if (accumulator.endsWith(toolUseOpeningTag)) {
				// start of a new tool use
				currentToolUse = {
					type: "tool_use",
					name: toolUseOpeningTag.slice(1, -1) as ToolUseName,
					params: {},
					partial: true,
				}
				currentToolUseStartIndex = accumulator.length
				// this also indicates the end of the current text content
				if (currentTextContent) {
					currentTextContent.partial = false
					// remove the partially accumulated tool use tag from the end of text (<tool)
					currentTextContent.content = currentTextContent.content
						.slice(0, -toolUseOpeningTag.slice(0, -1).length)
						.trim()
					contentBlocks.push(currentTextContent)
					currentTextContent = undefined
				}

				didStartToolUse = true
				break
			}
		}

		if (!didStartToolUse) {
			// no tool use, so it must be text either at the beginning or between tools
			if (currentTextContent === undefined) {
				currentTextContentStartIndex = i
			}
			currentTextContent = {
				type: "text",
				content: accumulator.slice(currentTextContentStartIndex).trim(),
				partial: true,
			}
		}
	}

	if (currentToolUse) {
		// stream did not complete tool call, add it as partial
		if (currentParamName) {
			// tool call has a parameter that was not completed
			currentToolUse.params[currentParamName] = accumulator.slice(currentParamValueStartIndex).trim()
		}
		contentBlocks.push(currentToolUse)
	}

	// Note: it doesnt matter if check for currentToolUse or currentTextContent, only one of them will be defined since only one can be partial at a time
	if (currentTextContent) {
		// stream did not complete text content, add it as partial
		contentBlocks.push(currentTextContent)
	}

	return contentBlocks
}

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

