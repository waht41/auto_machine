import { AskFollowupQuestionCommand } from '../types';
import { CommandExecutor, ExecutionContext } from '../command-executor';
import { RegisterExecutor } from '../registry';
import { Cline } from "@core/Cline";

@RegisterExecutor('ask_followup_question')
export class AskFollowupQuestionCommandExecutor implements CommandExecutor {
    async execute(command: AskFollowupQuestionCommand, context: any) {
        const cline: Cline = context?.['cline'];
        const replacing = context?.['replacing'];
        console.log('[waht] ask_followup_question', command.question, replacing);
        await cline.sayP({type: 'user_feedback', text: command.question, partial: false, replacing: replacing});
        return true;
    }
}