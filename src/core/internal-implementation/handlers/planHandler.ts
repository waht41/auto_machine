import { IInternalContext, PlanCommand } from '@core/internal-implementation/type';
import path from 'path';
import { getAssetPath } from '@core/storage/common';
import file from 'fs/promises';
import { yamlWrap } from '@core/internal-implementation/utils';
import logger from '@/utils/logger';
import { PlanService } from '@core/services/planService';

export function handlePlanCommand(command: PlanCommand, context: IInternalContext) {
	switch (command.action) {
		case 'start':
			return startPlan(command, context);
		case 'adjust':
			return adjustPlan(command, context);
		case 'complete_step':
			return nextStep(command, context);
		default:
			logger.error('handle plan command error', command);
			return 'unknown action';
	}
}

// generally, AI start plan from 1, but cline start from 0
async function startPlan(command: Extract<PlanCommand, { action: 'start' }>, context: IInternalContext) {
	const planService = await context.di.getByType(PlanService);
	planService.setPlan(command.content, 0);
	const triggerPlanPath = path.join(getAssetPath(), 'trigger','plan.yaml');
	const triggerContent = await file.readFile(triggerPlanPath, 'utf8');
	return yamlWrap(triggerContent) + '\n' + `you should: ${planService.getStep(0)} now`;
}

async function adjustPlan(command: Extract<PlanCommand, { action: 'adjust' }>, context: IInternalContext) {
	const internalStep = command.currentStep - 1;
	const planService = await context.di.getByType(PlanService);
	planService.setPlan(command.content, internalStep);
	return `you just adjust plan because: ${command.reason},\n now you should: ${planService.getStep(internalStep)}`;
}

async function nextStep(command: Extract<PlanCommand, { action: 'complete_step' }>, context: IInternalContext) {
	const planService = await context.di.getByType(PlanService);
	const nextStep = planService.nextStep(command.nextStep ? command.nextStep - 1 : undefined);
	if (nextStep){
		return 'now you need to do something for next step: ' + nextStep;
	}
	return null;
}