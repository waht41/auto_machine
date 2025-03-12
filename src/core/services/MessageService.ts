export class MessageService{
	private static instance: MessageService;
	private constructor(private postMessage: (message: any)=>void) {
	}
	static getInstance(postMessage: (message: any)=>void) {
		if (!MessageService.instance) {
			MessageService.instance = new MessageService(postMessage);
		}
		return MessageService.instance;
	}
	public async postMessageToWebview(message: any) {
		this.postMessage(message);
	}
}
