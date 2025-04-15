import Browser, {
	AnalyzeOptions,
	AuthOptions,
	DownloadOptions,
	InteractOptions,
	NavigateOptions,
	OpenOptions,
	SearchOptions
} from '@operation/Browser';
import File from '@operation/File';
import * as yaml from 'js-yaml';
import { CommandExecutor } from '@executors/types';
import { IInternalContext } from '@core/internal-implementation/type';

export class BrowserCommandExecutor implements CommandExecutor {
	async execute(command: BrowserCommand, context: IInternalContext): Promise<string> {
		const { cline } = context;
		switch (command.cmd) {
			case 'open':
				await Browser.open(command);
				return `open ${command.url} success`;
			case 'search':
				const searchRes = await Browser.search(command);
				return yaml.dump(searchRes.data);
			case 'state':
				return yaml.dump(await Browser.state());
			case 'analyze':
				return yaml.dump(await Browser.analyze(command));
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
				let partial = true;
				const messageId = cline.getNewMessageId();

				if (command.selector || command.tag || command.id || command.text) {
					// 使用浏览器下载
					for await (const progress of Browser.browserDownload(command)) {
						if (progress.status === 'completed'){
							partial = false;
						}
						await cline?.sayP({ sayType:'tool', text: JSON.stringify({...command,...progress}), partial, messageId });
					}
				} else {
					// 使用文件下载
					for await (const progress of File.download({ path:'./download',...command })) {
						if (progress.status === 'completed'){
							partial = false;
						}
						await cline?.sayP({ sayType:'tool', text: JSON.stringify({...command,...progress}), partial, messageId });
					}
				}
				return `Download ${command.url} to ${command.path ?? 'default path'} completed`;
			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}

export type BrowserCommand = {type:'browser'} & (
    {
        cmd: 'open';
    } & OpenOptions |
    {
        cmd: 'search';
    } & SearchOptions |
    {
        cmd: 'state';
    } |
    {
        cmd: 'analyze';
    } & AnalyzeOptions |
    {
        cmd: 'navigation';
    } & NavigateOptions |
    {
        cmd: 'interact';
    } & InteractOptions |
    {
        cmd: 'auth';
    } & AuthOptions |
    {
        cmd: 'download';
    } & DownloadOptions
    );