import { Middleware } from '@executors/types';
import { IInternalContext } from '@core/internal-implementation/type';

export const ApprovalMiddleWrapper = (allowedCommandJudge: { isAllowed: (commandStr:string)=>boolean }) => {
	const ApprovalMiddleware: Middleware = async (command, context: IInternalContext, next) => {
		if (!allowedCommandJudge.isAllowed(getCommandStr(command))&& !context.approval && !['base','approval','askApproval','ask','external'].includes(command.type)) {
			return await next({type:'ask',askType:'askApproval',content:command}, context);
		}
		return await next(command, context);
	};
	return ApprovalMiddleware;
};

export const getCommandStr = (command: any)=> {
	const possibleKeys = ['type', 'cmd','askType','action'];
	const segments = [];
	for (const key of possibleKeys) {
		if (command[key]) {
			segments.push(command[key]);
		}
	}
	return segments.join('.');
};
