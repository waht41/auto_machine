import {SYSTEM_PROMPT} from "@core/prompts/system";
import '@/utils/path'  // 用于修改默认的string方法，不过实话说写法很糟糕

const prompt = await SYSTEM_PROMPT(
    {globalStorageUri: {fsPath: 'E:\\project\\javascript\\puppy'}},
    'E:\\project\\javascript\\puppy',
    true)

console.log(prompt)