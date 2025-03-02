import { Middleware } from "@executors/types";
import { IInternalContext } from "@core/internal-implementation/type";

export const ApprovalMiddleWrapper = (allowedCommandsRef: { value: string[] }) => {
    console.log('[waht]','allowedCommands: ',allowedCommandsRef.value)
    const ApprovalMiddleware: Middleware = async (command, context: IInternalContext, next) => {
        if (!allowedCommandsRef.value.includes(command.type)&& !context.approval && !['ask','askApproval','approval'].includes(command.type)) {
            return await next({type:'ask',askType:'askApproval',content:command}, context);
        }
        return await next(command, context);
    };
    return ApprovalMiddleware;
}
