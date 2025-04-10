import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';
import { ICreateSubCline } from '@core/webview/type';

export class PostService {
	static serviceId: string = 'PostService';

	constructor(public postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
		public postStateToWebview: () => Promise<void>,
		public updateTaskHistory: (historyItem: HistoryItem) => Promise<void>,
		public createCline: ({task,images,parent}: ICreateSubCline) => Promise<string>
	) {
	}


}