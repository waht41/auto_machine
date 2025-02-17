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

export type IBaseCommand = {type:'base'} & ({
    cmd: 'log';
    text: string;
} | {
    cmd: 'think'; //某些思考模型自带的，模型不会主动调用
    text: string;
})