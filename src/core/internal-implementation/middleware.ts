import { Middleware } from "@executors/types";
import { IInternalContext } from "@core/internal-implementation/type";

export const ApprovalMiddleWrapper = (allowedCommands: string[]) => {
    const ApprovalMiddleware: Middleware = async (command, context: IInternalContext, next) => {
        if (!allowedCommands.includes(command.type)&& !context.approval && !['ask','askApproval','approval'].includes(command.type)) {
            return await next({type:'ask',askType:'askApproval',content:command}, context);
        }
        return await next(command, context);
    };
    return ApprovalMiddleware;
}
