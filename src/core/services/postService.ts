import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { ICreateSubCline } from '@core/webview/type';
import { SharedClineMessage } from '@/shared/type';
import { InterClineMessage } from '@core/services/type';

export class PostService {
	static serviceId: string = 'PostService';

	constructor(public postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
		public postStateToWebview: () => Promise<void>,
		public updateTaskHistory: (historyItem: HistoryItem) => Promise<void>,
		public createCline: ({task,images,parentId}: ICreateSubCline) => Promise<string>,
		public postInterClineMessage: (interClineMessage: InterClineMessage)=> Promise<void>
	) {
	}
	async postClineMessage(payload: SharedClineMessage){
		await this.postMessageToWebview({
			type: 'clineMessage',
			payload
		});
	}

}