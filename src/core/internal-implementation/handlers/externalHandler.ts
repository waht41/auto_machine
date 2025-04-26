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
	const shellInfo = detectShell();
	return `current platform ${os.platform()}, os version ${os.version()}, current user name: ${os.userInfo().username}，  
	current shell ${shellInfo.name}, version ${shellInfo.version}`;
}

function getBasicInfo() {
	const platform = os.platform();
	const userName = os.userInfo().username;
	const homedir = os.homedir();
	return `current platform: ${platform}, current user name: ${userName}, home dir: ${homedir}`;
}
