import { Cline } from '@core/Cline';

export type SecretKey =
	| 'apiKey'
	| 'glamaApiKey'
	| 'openRouterApiKey'
	| 'awsAccessKey'
	| 'awsSecretKey'
	| 'awsSessionToken'
	| 'openAiApiKey'
	| 'geminiApiKey'
	| 'openAiNativeApiKey'
	| 'deepSeekApiKey'
	| 'mistralApiKey'


export interface ICreateSubCline {
	task: string,
	images?: string[],
	parent: string
}

export type ClineNode = {
	id: string;
	cline: Cline;
	parent?: string;
	children?: string[];
}