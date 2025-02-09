export type CommandType = 'click' | 'type' | 'open' | 'define' | 'external';

export interface BaseCommand {
    type: CommandType;
}

export interface ClickCommand extends BaseCommand {
    type: 'click';
    target: string;
    context?: string; // "in" 后面的内容
}

export interface TypeCommand extends BaseCommand {
    type: 'type';
    content: string;
}

export interface OpenCommand extends BaseCommand {
    type: 'open';
    application: string;
}

export interface MacroDefinition extends BaseCommand {
    type: 'define';
    name: string;
    commands: Command[];
}

export interface ExternalCommand extends BaseCommand {
    type: 'external';
    request: string;
}

export type Command = ClickCommand | TypeCommand | OpenCommand | MacroDefinition | ExternalCommand;
