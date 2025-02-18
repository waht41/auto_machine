import { CommandExecutor } from "@executors/command-executor";
import { IAskCommand } from "@core/internal-implementation/type";

export class AskCommandExecutor implements CommandExecutor {
    async execute(command: IAskCommand, context: any): Promise<void> {
        const cline = context.cline;
        const replacing = context.replacing;
        await cline.askP({askType: command.askType, text: command.question, partial: false, replacing: replacing});
    }
}

