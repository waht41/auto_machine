import envPaths from 'env-paths';
import fs from 'fs';
import process from 'node:process';
import path from 'path';
const envPath = envPaths('auto_machine',{suffix:''});

export const configPath = envPath.config;

export function getAssetPath(): string{
	return process.env.ASSETS_PATH ?? path.join(process.cwd(), './assets');
}

export function createIfNotExists(path: string): void {
	if (!fs.existsSync(path)) {
		fs.mkdirSync(path, {recursive: true});
	}
}