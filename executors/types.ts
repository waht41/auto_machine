import { BaseCommand } from "@executors/base";
import { FileCommand } from "@executors/implementations/file";
import { BrowserCommand } from "@executors/implementations";



interface CommandMap {
    click: ClickCommand;
    type: TypeCommand;
    open: OpenCommand;
    define: MacroDefinition;
    external: ExternalCommand;
    file: FileCommand;
    browser: BrowserCommand;
}

export interface ClickCommand extends BaseCommand<'click'> {
    target: string;
    context?: string;
}

export interface TypeCommand extends BaseCommand<'type'> {
    content: string;
}

export interface OpenCommand extends BaseCommand<'open'> {
    application: string;
}

export interface MacroDefinition extends BaseCommand<'define'> {
    name: string;
    commands: Command[];
}

export interface ExternalCommand extends BaseCommand<'external'> {
    request: string;
}

export type CommandType = keyof CommandMap;
export type Command = CommandMap[CommandType];
