import { Command, CommandExecutor, ExecutionContext } from "@executors/types";

export class SafeCommandExecutor implements CommandExecutor {
    constructor(
        private wrapped: CommandExecutor,
        private errorHandler: (error: Error, command: any) => void = defaultErrorHandler
    ) {}

    async execute(command: Command, context: ExecutionContext) {
        try {
            return await this.wrapped.execute(command, context);
        } catch (e) {
            return this.errorHandler(e, command);
        }
    }
}

export function defaultErrorHandler(error: Error, command: Command) {
    const errorMessage = `Error executing command ${command} - ${error}`;
    console.error(errorMessage);
    return errorMessage;
}
