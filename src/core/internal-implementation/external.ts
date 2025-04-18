import file from 'fs/promises';
import path from 'path';
import { CommandExecutor } from '@executors/types';
import { getAssetPath } from '@core/storage/common';
import { yamlWrap } from '@core/internal-implementation/utils';
import { getAdditionalPrompt } from '@core/internal-implementation/handlers/externalHandler';

export class ExternalCommandExecutor implements CommandExecutor {
	async execute(command: ExternalCommand) {
		console.log(`Executing: Open External "${command.request}"`);
		try {
			const fileNames = command.request.split(',').map(name => name.trim());
			const prompts = await Promise.all(
				fileNames.map(fileName =>
					file.readFile(path.join(getAssetPath(), 'external-prompt', `${fileName}.yaml`), 'utf8')
				)
			);
			return yamlWrap(prompts)+ '\n' + getAdditionalPrompt(fileNames); // 使用 YAML 分隔符分隔多个文件的内容
		} catch (e) {
			const msg = `Failed to open External "${command.request}"`;
			console.error(msg);
			return msg;
		}

	}
}

export type ExternalCommand = {
    type: 'external';
    request: string;
}