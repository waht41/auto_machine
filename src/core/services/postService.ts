import { ExtensionMessage } from '@/shared/ExtensionMessage';

export class PostService {
	static serviceId: string = 'PostService';

	constructor(public postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
	public postStateToWebview: ()=>Promise<void>
	) {}


}