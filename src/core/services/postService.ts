import { ExtensionMessage } from '@/shared/ExtensionMessage';
import { HistoryItem } from '@/shared/HistoryItem';

export class PostService {
	static serviceId: string = 'PostService';

	constructor(public postMessageToWebview: (message: ExtensionMessage) => Promise<void>,
		public postStateToWebview: () => Promise<void>,
		public updateTaskHistory: (historyItem: HistoryItem) => Promise<void>
	) {
	}


}