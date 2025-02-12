import { Command } from './types';

export interface ExecutionContext {
    variables: Map<string, any>;
    macros: Map<string, Command[]>;
}

export interface CommandExecutor {
    execute(command: Command, context: any): any;
}

export class SafeCommandExecutor implements CommandExecutor {
    constructor(
        private wrapped: CommandExecutor,
        private errorHandler: (error: Error, command: Command) => void = defaultErrorHandler
    ) {}

    async execute(command: Command, context: ExecutionContext) {
        try {
            return await this.wrapped.execute(command, context);
        } catch (e) {
            return this.errorHandler(e as Error, command);
        }
    }
}

export function defaultErrorHandler(error: Error, command: Command) {
    const errorMessage = `Error executing command ${command.type}: ${error.message}`;
    console.error(errorMessage);
    return errorMessage;
}
