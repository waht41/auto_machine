import fs from 'fs';
import path from 'path';
import file from 'fs/promises';
import { getAssetPath } from '@core/storage/common';
import { yamlWrap } from '@core/internal-implementation/utils';

let prompt = '';

export const AM_PROMPT = async (
	defaultExternals = ['Advance']
): Promise<string> => {
	if (!prompt) {
		if (!Array.isArray(defaultExternals)) {
			defaultExternals = [defaultExternals];
		}
		const externals = await Promise.all(
			defaultExternals.map(fileName =>
				file.readFile(path.join(getAssetPath(), 'external-prompt', `${fileName}.yaml`), 'utf8')
			)
		);
		const base = fs.readFileSync(path.join(getAssetPath(), 'base.md'), 'utf8');
		prompt = yamlWrap(externals) + '\n' + base;
	}
	return prompt;
};