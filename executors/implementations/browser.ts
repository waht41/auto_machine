import { CommandExecutor } from "../command-executor";
import File from "@operation/File"
import { CreateOptions, EditOptions, ListOptions, ReadOptions, SearchOptions } from "@operation/File/type";
import { BaseCommand } from "@executors/base";
import { RegisterExecutor } from "@executors/registry";
import Browser, { AnalyzeOptions, InteractOptions, NavigateOptions, OpenOptions } from "@operation/Browser";

@RegisterExecutor('browser')
export class BrowserCommandExecutor implements CommandExecutor {
    execute(command: BrowserCommand, context: any): any {
        switch (command.cmd) {
            case 'open':
                return Browser.open(command);
            case 'state':
                return Browser.state();
            case 'analyze':
                return Browser.analyze(command);
            case 'navigation':
                return Browser.navigate(command);
            case 'interact':
                return Browser.interact(command);
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