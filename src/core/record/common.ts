import envPaths from "env-paths";
import fs from "fs";
const envPath = envPaths("auto_machine",{suffix:''});

export const configPath = envPath.config;

export function createIfNotExists(path: string): void {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, {recursive: true});
    }
}