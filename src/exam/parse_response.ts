import {parseAssistantMessage} from "@core/assistant-message";

let resExam= `
{
  type: 'text',
  text: '\`\`\`xml\\n' +
    '<list_files>\\n' +
    '<path>.</path>\\n' +
    '<recursive>true</recursive>\\n' +
    '</list_files>\\n' +
    '\`\`\`'
}
{ type: 'usage', inputTokens: 8033, outputTokens: 30 }
`

const parsed = parseAssistantMessage(`'\`\`\`xml\\n' +
    '<list_files>\\n' +
    '<path>.</path>\\n' +
    '<recursive>true</recursive>\\n' +
    '</list_files>\\n' +
    '\`\`\`'`)
console.log(parsed)