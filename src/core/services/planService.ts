import logger from '@/utils/logger';
import { IPlan } from '@core/services/type';
import { UIMessageService } from '@core/services/UIMessageService';

export class PlanService {
	static readonly serviceId = 'PlanService';
	steps: string[] = [];
	currentStep: number = 0;

	constructor(private uiMessageService: UIMessageService) {
		this.init();
	}

	init() {
		const planSnapshot = this.uiMessageService.getState('plan');
		if (planSnapshot) {
			this.steps = planSnapshot.steps;
			this.currentStep = planSnapshot.currentStep;
		}
	}

	setPlan(steps: string[], currentStep: number, ) {
		this.steps = steps;
		this.currentStep = currentStep;
	}

	getStep(index: number) {
		if (index >= this.steps.length) {
			logger.error(`getPlan index: ${index} out of range, plan`, this.steps);
			return null;
		}
		return this.steps[index];
	}

	nextStep(stepNumber?: number) {
		if (stepNumber) {
			if (stepNumber < 0){
				return null;
			}
			if (stepNumber < this.currentStep){
				return 'you can not go back by nextStep, use adjust instead';
			}
		}
		if (this.currentStep >= this.steps.length) {
			return null;
		}
		return this.steps[++this.currentStep];
	}

	getCurrentStep() {
		if (this.steps.length === 0 || this.currentStep >= this.steps.length) {
			return null;
		}
		return this.getStep(this.currentStep);
	}

	getPlanSnapshot(): IPlan {
		return {
			steps: [...this.steps], // 返回副本避免外部修改
			currentStep: this.currentStep
		};
	}
}