import { IInternalContext, PlanCommand } from '@core/internal-implementation/type';
import path from 'path';
import { getAssetPath } from '@core/storage/common';
import file from 'fs/promises';
import { yamlWrap } from '@core/internal-implementation/utils';
import logger from '@/utils/logger';

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

async function startPlan(command: Extract<PlanCommand, { action: 'start' }>, context: IInternalContext) {
	const cline = context.cline;
	await cline.setPlan(command.content);
	const triggerPlanPath = path.join(getAssetPath(), 'trigger','plan.yaml');
	const triggerContent = await file.readFile(triggerPlanPath, 'utf8');
	return yamlWrap(triggerContent) + '\n' + `current step: ${cline.getStep(0)}`;
}

async function adjustPlan(command: Extract<PlanCommand, { action: 'adjust' }>, context: IInternalContext) {
	const cline = context.cline;
	await cline.setPlan(command.content, command.currentStep);
	return command.reason;
}

async function nextStep(command: Extract<PlanCommand, { action: 'complete_step' }>, context: IInternalContext) {
	const cline = context.cline;
	const nextStep = await cline.nextStep();
	if (nextStep){
		return 'next step: ' + nextStep;
	}
	return 'no more step, stop plan';
}