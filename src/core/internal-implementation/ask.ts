import { CommandExecutor } from "@executors/command-executor";

export class AskCommandExecutor implements CommandExecutor {
    async execute(command: IAskCommand, context: any): Promise<void> {
        const cline = context.cline;
        const replacing = context.replacing;
        await cline.askP({askType: command.askType, text: command.question, partial: false, replacing: replacing});
    }
}

export type IAskCommand = {type:'ask'} & ({
    askType: 'followup';
    question: string;
} | {
    askType: 'choice';
    question: string;
    choices: string[];
} | {
    askType: 'multiple_choice';
    question: string;
    choices: string[];
} | {
    askType: 'attempt_completion';
    question: string;
})