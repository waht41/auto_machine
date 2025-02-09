import { Command } from './types';

export interface ExecutionContext {
    variables: Map<string, any>;
    macros: Map<string, Command[]>;
}

export interface CommandExecutor {
    execute(command: Command, context: ExecutionContext): any;
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
            this.errorHandler(e as Error, command);
        }
    }
}

export function defaultErrorHandler(error: Error, command: Command): void {
    console.error(`Error executing command ${command.type}: ${error.message}`);
}
