import fs from "fs";
import path from "path";

let prompt = ''
export const AM_PROMPT = async (
  ...prop: any
): Promise<string> => {
    if (!prompt){
        prompt = fs.readFileSync(path.join(__dirname, 'base.md'), 'utf8')
    }
    return prompt
}
