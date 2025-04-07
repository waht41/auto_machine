import { parseBlocks } from '../parse-assistant-message';

describe('parseBlocks', () => {
	it('should parse complete YAML block with ```yaml', () => {
		const input = `这是一段普通文本
\`\`\`yaml
- tool: thinking
  content: 这是思考内容
\`\`\`
这是后续文本`;

		const result = parseBlocks(input);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({
			type: 'text',
			content: '这是一段普通文本',
			partial: false
		});
		expect(result[1]).toEqual({
			type: 'tool_use',
			name: 'thinking',
			params: {
				content: '这是思考内容'
			},
			partial: false
		});
		expect(result[2]).toEqual({
			type: 'text',
			content: '这是后续文本',
			partial: true
		});
	});

	it('should treat incomplete YAML block as text', () => {
		const input = `开始文本
\`\`\`yaml
- tool: ask_followup_question
  question: 这是一个问题`;

		const result = parseBlocks(input);
		expect(result).toHaveLength(2);
		expect(result[1]).toEqual({
			type: 'text',
			content: '- tool: ask_followup_question\n  question: 这是一个问题',
			partial: true
		});
	});

	it('should parse multiple YAML blocks', () => {
		const input = `第一段文本
\`\`\`yaml
- tool: thinking
  content: 思考内容1
\`\`\`
中间文本
\`\`\`yaml
- tool: log
  content: 日志内容
\`\`\`
结束文本`;

		const result = parseBlocks(input);
		expect(result).toHaveLength(5);
		expect(result.filter(block => block.type === 'tool_use')).toHaveLength(2);
	});

	it('should treat non-yaml code blocks as text', () => {
		const input = `前导文本
\`\`\`
- tool: log
  summary: 测试日志
  content: 这是日志内容
\`\`\``;

		const result = parseBlocks(input);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			type: 'text',
			content: '前导文本',
			partial: false
		});
		expect(result[1]).toEqual({
			type: 'text',
			content: '\`\`\`\n- tool: log\n  summary: 测试日志\n  content: 这是日志内容\n\`\`\`',
			partial: false
		});
	});

	it('should handle non-YAML code blocks and YAML blocks correctly', () => {
		const input = `有一段代码：
\`\`\`typescript
const x = 1;
\`\`\`
然后是YAML：
\`\`\`yaml
- tool: thinking
  content: 测试内容
\`\`\``;

		const result = parseBlocks(input);
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual({
			type: 'text',
			content: '有一段代码：',
			partial: false
		});
		expect(result[1]).toEqual({
			type: 'text',
			content: '\`\`\`typescript\nconst x = 1;\n\`\`\`',
			partial: false
		});
		expect(result[2]).toEqual({
			type: 'text',
			content: '然后是YAML：',
			partial: false
		});
		expect(result[3]).toEqual({
			type: 'tool_use',
			name: 'thinking',
			params: {
				content: '测试内容'
			},
			partial: false
		});
	});

	it('should skip non-YAML code blocks', () => {
		const input = `有一段代码：
\`\`\`typescript
const x = 1;
\`\`\`
然后是YAML：
\`\`\`yaml
- tool: thinking
  content: 测试内容
\`\`\``;

		const result = parseBlocks(input);
		console.log('Input:', input);
		console.log('Parse result:', JSON.stringify(result, null, 2));

		const toolBlocks = result.filter(block => {
			console.log('Block:', block);
			return block.type === 'tool_use';
		});
		expect(toolBlocks).toHaveLength(1);
		expect(toolBlocks[0].name).toBe('thinking');
	});

	it('should handle malformed YAML content', () => {
		const input = `\`\`\`yaml
invalid: yaml: content:
  - not properly formatted
\`\`\``;

		const result = parseBlocks(input);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: 'text',
			content: 'invalid: yaml: content:\n  - not properly formatted',
			partial: false
		});
	});

	it('should handle empty blocks', () => {
		const input = `\`\`\`yaml
\`\`\``;

		const result = parseBlocks(input);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: 'text',
			content: '',
			partial: false
		});
	});

	it('should parse multiple tools in single YAML block', () => {
		const input = `开始文本
\`\`\`yaml
- tool: thinking
  content: 第一个思考
- tool: ask_followup_question
  question: 这是一个问题
\`\`\`
结束文本`;

		const result = parseBlocks(input);
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual({
			type: 'text',
			content: '开始文本',
			partial: false
		});
		expect(result[1]).toEqual(
			{
				type: 'tool_use',
				name: 'thinking',
				params: {
					content: '第一个思考'
				},
				partial: false
			},
		);
		expect(result[2]).toEqual(
			{
				type: 'tool_use',
				name: 'ask_followup_question',
				params: {
					question: '这是一个问题'
				},
				partial: false
			},
		);
		expect(result[3]).toEqual({
			type: 'text',
			content: '结束文本',
			partial: true
		});
	});
});
