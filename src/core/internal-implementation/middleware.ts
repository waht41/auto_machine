import { Command, Middleware } from '@executors/types';
import { IInternalContext } from '@core/internal-implementation/type';
import { AllowedToolTree } from '@core/tool-adapter/AllowedToolTree';

export const ApprovalMiddleWrapper = (gate: AllowedToolTree) => {
	const ApprovalMiddleware: Middleware = async (command, context: IInternalContext, next) => {
		if (!isAutoApproval(command, gate) && !context.approval) {
			return await next({type:'ask',askType:'askApproval',content:command}, context);
		}
		return await next(command, context);
	};
	return ApprovalMiddleware;
};

export const isAutoApproval = (command:Command, gate: AllowedToolTree):boolean => {
	return gate.isAllowed(getCommandStr(command)) || ['base','approval','askApproval','ask','external'].includes(command.type);
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
