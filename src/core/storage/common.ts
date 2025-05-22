import envPaths from 'env-paths';
import fs from 'fs';
import process from 'node:process';
import path from 'path';

const envPath = envPaths('Auto Machine',{suffix:''});

export const configPath = envPath.config;

export function getPromptPath(): string{
	return path.join(getAssetPath(),'prompt','en');
}

export function getAssetPath(): string{
	return process.env.ASSETS_PATH ?? path.join(process.cwd(), './assets');
}

export function getUserDataPath(): string{
	return process.env.USER_DATA_PATH ?? path.join(process.cwd(), './autoMachineUserData');
}

export function createIfNotExists(path: string): void {
	if (!fs.existsSync(path)) {
		fs.mkdirSync(path, {recursive: true});
	}
}

export function getLogPath(): string {
	return process.env.LOG_PATH ?? path.join(process.cwd(), './logs');
}

export function sanitizeFileName(name: string) {
	// 生成0x00到0x1F的控制字符
	const controlChars = Array.from({ length: 0x20 }, (_, i) =>
		String.fromCharCode(i)
	).join('');
	// 原正则中的其他非法字符，转义反斜杠
	const illegalChars = '<>:"/\\\\|?*';
	// 构建正则表达式，将控制字符和其他非法字符合并到字符类中
	const regex = new RegExp(`[${illegalChars}${controlChars}]`, 'g');
	return name.replace(regex, '_')
		.replace(/\s+/g, '_')  // 替换空格为下划线
		.replace(/^\.+/, '')   // 移除开头的点
		.replace(/\.+$/, '');  // 移除结尾的点
}