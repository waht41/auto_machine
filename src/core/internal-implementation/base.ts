import { CommandExecutor } from "@executors/command-executor";
import { IInternalContext } from "@core/internal-implementation/type";

export class BaseCommandExecutor implements CommandExecutor {
    async execute(command: IBaseCommand, context: IInternalContext): Promise<boolean> {
        const cline = context.cline;
        const replacing = context.replacing;
        await cline.sayP({sayType: 'text', text: command.text, partial: false, replacing: replacing});
        return true;
    }
}

export type IBaseCommand = {
    type: 'log';
    text: string;
}