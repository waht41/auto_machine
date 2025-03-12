import fs from 'fs';
import path from 'path';
import * as process from 'node:process';

let prompt = '';

export const AM_PROMPT = async (
	...prop: any
): Promise<string> => {
	if (!prompt) {
		const assetPath = process.env.ASSETS_PATH ?? path.join(process.cwd(), './assets');
		prompt = fs.readFileSync(path.join(assetPath, 'base.md'), 'utf8');
	}
	return prompt;
};
