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
    ask_followup_question: AskFollowupQuestionCommand;
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

export interface AskFollowupQuestionCommand extends BaseCommand<'ask_followup_question'> {
    question: string;
    context?: ExecutionContext;
}


export type CommandType = keyof CommandMap;
export type Command = CommandMap[CommandType];
