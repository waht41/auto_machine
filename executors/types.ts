export type ExecutionContext = any

export interface CommandExecutor {
    execute(command: Command, context: any): any;
}
export type Command = {
    type: string;
    [key: string]: any;
}

export type Middleware = (
    command: Command,
    context: ExecutionContext,
    next: (command: Command, context: ExecutionContext) => Promise<any>
) => Promise<any>;