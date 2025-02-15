import { ExecutionContext } from "./command-executor";

export interface BaseCommand<T extends string> {
    type: T;
}

interface CommandMap {
    click: ClickCommand;
    type: TypeCommand;
    open: OpenCommand;
    define: MacroDefinition;
    external: ExternalCommand;
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
