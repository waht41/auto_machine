import { parseToolsFromFiles } from "./toolParse";
import path from "path";
import fs from "fs";


export function getToolCategory(promptPath: string) {
    const files = fs.readdirSync(promptPath); // 读取目录下所有文件/子目录
    const filePaths = [];

    for (const file of files) {
        const filePath = path.join(promptPath, file);
        if (
            fs.statSync(filePath).isFile() &&
            ['.yaml', '.yml'].includes(path.extname(filePath).toLowerCase())
        ) {
            filePaths.push(filePath);
        }
    }

    return parseToolsFromFiles(filePaths);
}