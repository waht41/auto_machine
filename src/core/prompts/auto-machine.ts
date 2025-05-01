import fs from 'fs';
import path from 'path';
import file from 'fs/promises';
import { getPromptPath } from '@core/storage/common';
import { yamlWrap } from '@core/internal-implementation/utils';

let prompt = '';
interface IProp{
	defaultExternals?: string[];
	defaultTriggers?: string[];
}

export const AM_PROMPT = async (
	prop: IProp
): Promise<string> => {
	const {defaultExternals = ['Advance'], defaultTriggers = []} = prop;
		
	const externals = await Promise.all(
		defaultExternals.map(fileName =>
			file.readFile(path.join(getPromptPath(), 'external-prompt', `${fileName}.yaml`), 'utf8')
		)
	);
	const triggers = await Promise.all(
		defaultTriggers.map(fileName =>
			file.readFile(path.join(getPromptPath(), 'trigger', `${fileName}.yaml`), 'utf8')
		)
	);
	const base = fs.readFileSync(path.join(getPromptPath(), 'base.md'), 'utf8');
	prompt = [yamlWrap(externals), triggers.join('\n'), base].join('\n');
	return prompt;
};