import {parseAssistantMessage, } from "@core/assistant-message";
import { parseBlocks } from "@core/assistant-message/parse-assistant-message";

let resExam= `'\`\`\`xml\\n' +
    '<list_files>\\n' +
    '<path>.</path>\\n' +
    '<recursive>true</recursive>\\n' +
    '</list_files>\\n' +
    '\`\`\`'
`

resExam = `
<external>
<request>File</request>
</external>

我将请求读取文件a.txt的内容。请稍等片刻。
`

resExam = '<external>'

const parsed = parseAssistantMessage(resExam)
console.log(parsed)

const parsed2 = parseBlocks(resExam)
console.log(parsed2)