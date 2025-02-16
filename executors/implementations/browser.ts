import { CommandExecutor } from "../command-executor";
import { BaseCommand } from "@executors/base";
import { RegisterExecutor } from "@executors/registry";
import Browser, {
    AnalyzeOptions,
    InteractOptions,
    NavigateOptions,
    OpenOptions,
    SearchOptions
} from "@operation/Browser";

@RegisterExecutor('browser')
export class BrowserCommandExecutor implements CommandExecutor {
    async execute(command: BrowserCommand, context: any): Promise<any> {
        switch (command.cmd) {
            case 'open':
                await Browser.open(command);
                return 'success';
            case 'search':
                const searchRes = await Browser.search(command);
                return JSON.stringify(searchRes.data);
            case 'state':
                return JSON.stringify(await Browser.state());
            case 'analyze':
                return JSON.stringify(await Browser.analyze(command));
            case 'navigation':
                await Browser.navigate(command);
                return 'success';
            case 'interact':
                const res = await Browser.interact(command)
                if (res.isNewPage) {
                    return 'success get get new page: ' + JSON.stringify(res.data);
                } else {
                    return 'success'
                }
            default:
                throw new Error(`Unknown action: ${command}`);
        }
    }
}

export type BrowserCommand = BaseCommand<'browser'> & (
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
    } & InteractOptions
    );