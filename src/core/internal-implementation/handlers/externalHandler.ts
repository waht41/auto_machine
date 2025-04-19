import { detectShell } from '@/utils/shell';
import os from 'os';

type ExternalHandler = {
  [key: string]: () => string;
};

const additionalPromptHandler: ExternalHandler = {
	'Coder': getCoderAdditional,
	'File': getBasicInfo,
	'Browser': getBasicInfo,
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

function getBasicInfo() {
	const platform = os.platform();
	const userName = os.userInfo().username;
	const homedir = os.homedir();
	return `current platform: ${platform}, current user name: ${userName}, home dir: ${homedir}`;
}
