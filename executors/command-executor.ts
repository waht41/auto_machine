import { Command } from './types';

export type ExecutionContext = any

export interface CommandExecutor {
    execute(command: any, context: any): any;
}

export class SafeCommandExecutor implements CommandExecutor {
    constructor(
        private wrapped: CommandExecutor,
        private errorHandler: (error: Error, command: any) => void = defaultErrorHandler
    ) {}

    async execute<T>(command: T, context: ExecutionContext) {
        try {
            return await this.wrapped.execute(command, context);
        } catch (e) {
            return this.errorHandler(e, command);
        }
    }
}

export function defaultErrorHandler<T>(error: Error, command: T) {
    const errorMessage = `Error executing command ${command} - ${error}`;
    console.error(errorMessage);
    return errorMessage;
}
