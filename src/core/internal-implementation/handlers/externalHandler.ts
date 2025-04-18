import { detectShell } from '@/utils/shell';
import os from 'os';

type ExternalHandler = {
  [key: string]: () => string;
};

const additionalPromptHandler: ExternalHandler = {
	'Coder': getCoderAdditional
};

export function getAdditionalPrompt(fileNames: string[]) {
	return fileNames.map(fileName => {
		if (fileName in additionalPromptHandler) {
			return additionalPromptHandler[fileName]();
		}
		return '';
	}).join('\n');
}


function getCoderAdditional() {
	return `current platform ${os.platform()}, current shell ${detectShell()}`;
}