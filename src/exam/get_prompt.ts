import {SYSTEM_PROMPT} from "@core/prompts/system";
import '@/utils/path'  // 用于修改默认的string方法，不过实话说写法很糟糕
async function test() {
    const prompt = await SYSTEM_PROMPT(
        {globalStorageUri: {fsPath: 'E:\\project\\javascript\\auto_machine'}},
        'E:\\project\\javascript\\auto_machine',
        true)

    console.log(prompt)
}
test()