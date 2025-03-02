import { CommandExecutor } from "@executors/types";
import { IAskCommand, IInternalContext } from "@core/internal-implementation/type";

export class AskCommandExecutor implements CommandExecutor {
    async execute(command: IAskCommand, context: IInternalContext): Promise<any> {
        const cline = context.cline;
        const replacing = context.replacing;
        await cline.askP({askType:"tool", text: JSON.stringify(command), partial: false, replacing: replacing});
        return 'wait for ask';  //todo waht 需要修改返回
    }
}

