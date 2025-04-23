import Browser from '@operation/Browser';
import * as yaml from 'js-yaml';
import { CommandExecutor } from '@executors/types';
import { BrowserCommand, IInternalContext } from '@core/internal-implementation/type';
import { handleLongAnalyzeResult, handleDownloadCommand } from './handlers/browserHandler';

export class BrowserCommandExecutor implements CommandExecutor {
	async execute(command: BrowserCommand, context: IInternalContext): Promise<string> {
		const { cline } = context;
		let messageId: number;
		switch (command.cmd) {
			case 'open':
				await Browser.open(command);
				return `open ${command.url} success`;
			case 'search':
				messageId = cline.getNewMessageId();
				await cline.sayP({sayType:'tool',text:JSON.stringify(command),messageId});
				const searchRes = await Browser.search(command);
				await cline.sayP({sayType:'tool',text:JSON.stringify({ ...command, complete: true }),messageId});
				return yaml.dump(searchRes.data);
			case 'state':
				return yaml.dump(await Browser.state());
			case 'analyze':
				return handleLongAnalyzeResult(await Browser.analyze(command));
			case 'navigation':
				await Browser.navigate(command);
				return `navigation ${command.action} at ${command.url} success`;
			case 'interact':
				const res = await Browser.interact(command);
				if (res.isNewPage) {
					return `${command.url} interact ${command.action} success, and get get new page: ` + yaml.dump(res.data);
				} else {
					return `${command.url} interact ${command.action} success`;
				}
			case 'auth':
				await Browser.auth(command);
				return 'auth success';
			case 'download':
				return await handleDownloadCommand(command as BrowserCommand & { cmd: 'download' }, context);
			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}