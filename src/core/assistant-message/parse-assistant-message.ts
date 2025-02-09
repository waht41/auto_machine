import {
	AssistantMessageContent,
	TextContent,
	ToolUse,
	ToolParamName,
	toolParamNames,
	toolUseNames,
	ToolUseName,
} from "."

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

export function parseBlocks(str: string, blocks: AssistantMessageContent[] = []): AssistantMessageContent[] {
	const [textContent, toolStartIndex, toolName] = findNextTool(str);

	const hasToolBlock = toolStartIndex !== -1;

	if (textContent.length > 0) {
		// 如果后面有工具块，当前文本块的partial为false
		blocks.push(createTextBlock(textContent, !hasToolBlock));
	}

	if (!hasToolBlock || !toolName) return blocks;

	const remainingStr = str.slice(toolStartIndex);
	const [toolBlock, processedLength] = parseToolBlock(remainingStr, toolName);

	if (toolBlock) {
		blocks.push(toolBlock);
		return parseBlocks(remainingStr.slice(processedLength), blocks);
	}

	return blocks.concat(createTextBlock(remainingStr, true));
}

function findNextTool(str: string): [string, number, string | null] {
	const TAG_REGEX = /<([^>]+?)>/g;
	let earliest: { index: number; tag: string } | null = null;

	let match;
	while ((match = TAG_REGEX.exec(str)) !== null) {
		if (!earliest || match.index < earliest.index) {
			earliest = { index: match.index, tag: match[1] };
		}
	}

	return earliest ?
		[str.slice(0, earliest.index).trim(), earliest.index, earliest.tag] :
		[str.trim(), -1, null];
}

function parseToolBlock(str: string, toolName: string) : [AssistantMessageContent, number] {
	const startTag = `<${toolName}>`;
	const endTag = `</${toolName}>`;
	const endIndex = str.indexOf(endTag);

	// 处理完整工具块
	if (endIndex !== -1) {
		const content = str.slice(startTag.length, endIndex);
		return [{
			type: 'tool_use',
			name: toolName,
			params: parseXMLParams(content),
			partial: false
		}, endIndex + endTag.length];
	}

	// 处理部分工具块
	const content = str.slice(startTag.length);
	return [{
		type: 'tool_use',
		name: toolName,
		params: parsePartialXMLParams(content),
		partial: true
	}, str.length];
}

// 完整参数解析（带闭合标签）
function parseXMLParams(content: string): Record<string, string> {
	const params: Record<string, string> = {};
	let pos = 0;

	while (pos < content.length) {
		const startMatch = content.slice(pos).match(/<([^>]+?)>/);
		if (!startMatch) break;

		const tagName = startMatch[1];
		const start = pos + startMatch.index! + startMatch[0].length;
		const endTag = `</${tagName}>`;
		const end = content.indexOf(endTag, start);

		if (end === -1) {
			params[tagName] = content.slice(start).trim();
			break;
		}

		params[tagName] = content.slice(start, end).trim();
		pos = end + endTag.length;
	}

	return params;
}

// 部分参数解析（处理未闭合标签）
function parsePartialXMLParams(content: string): Record<string, string> {
	const params: Record<string, string> = {};
	let pos = 0;

	while (pos < content.length) {
		const startMatch = content.slice(pos).match(/<([^>]+?)>/);
		if (!startMatch) break;

		const tagName = startMatch[1];
		const start = pos + startMatch.index! + startMatch[0].length;

		// 取从开始标签到下一个标签开始前的内容
		const nextTagStart = content.indexOf('<', start);
		const valueEnd = nextTagStart === -1 ? content.length : nextTagStart;

		params[tagName] = content.slice(start, valueEnd).trim();
		pos = start;
	}

	return params;
}

function createTextBlock(content: string, partial: boolean): TextContent {
	return {
		type: 'text',
		content: content.trim(),
		partial: partial || /<[^>]+$/.test(content) // 检测未闭合标签
	};
}

