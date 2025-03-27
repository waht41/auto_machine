import logger from '@/utils/logger';
import { IPlan } from '@core/services/type';

export class PlanService {
	steps: string[] = [];
	currentStep: number = 0;

	setPlan(steps: string[], currentStep: number) {
		this.steps = steps;
		this.currentStep = currentStep;
	}

	getStep(index: number) {
		if (index >= this.steps.length) {
			logger.error(`getPlan index: ${index} out of range, plan`, this.steps);
			return 'get step error, index out of range';
		}
		return this.steps[index];
	}

	nextStep() {
		if (++this.currentStep === this.steps.length) {
			return 'no more steps';
		} if (this.currentStep > this.steps.length) {
			return null;
		}
		return this.steps[this.currentStep];
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