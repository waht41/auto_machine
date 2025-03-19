import { AssistantMessageContent } from '@core/assistant-message';
import cloneDeep from 'clone-deep';
import { parseBlocks } from '@core/assistant-message/parse-assistant-message';
import logger from '@/utils/logger';

export interface BlockState {
	remaining?: boolean,
	last?: boolean,
	overLimit?: boolean
}

export class BlockProcessHandler {
	private currentBlockIndex = 0;
	private presentAssistantMessageLocked = false;
	private presentAssistantMessageHasPendingUpdates = false;
	private assistantMessageBlocks: AssistantMessageContent[] = [];
	private blockMessageIds: number[] = [];
	private prevLength = 0;

	public reset() {
		this.currentBlockIndex = 0;
		this.blockMessageIds = [];
		this.assistantMessageBlocks = [];
		this.presentAssistantMessageHasPendingUpdates = false;
		this.presentAssistantMessageLocked = false;
	}

	public setAssistantMessageBlocks(assistantMessage: string): void {
		this.prevLength = this.assistantMessageBlocks.length;
		this.assistantMessageBlocks = parseBlocks(assistantMessage);
	}

	public addMessageId(msgId: number): void {
		this.blockMessageIds.push(msgId);
		if (this.blockMessageIds.length !== this.assistantMessageBlocks.length) {
			console.error('BlockProcessHandler: blockMessageIds and assistantMessageBlocks are not the same length');
		}
		logger.debug('BlockProcessHandler: addMessageId', this.blockMessageIds);
	}

	public getCurrentMessageId(): number {
		return this.blockMessageIds[this.currentBlockIndex];
	}

	public hasNewBlock(): boolean {
		return this.assistantMessageBlocks.length > this.prevLength;
	}

	public hasPartialBlock(): boolean {
		return this.assistantMessageBlocks.some(block => block.partial);
	}

	public markPartialBlockAsComplete(): void {
		this.assistantMessageBlocks.forEach((item) =>{
			item.partial = false;
		});
	}

	public getCurrentBlock(): AssistantMessageContent {
		return cloneDeep(this.assistantMessageBlocks[this.currentBlockIndex]);
	}

	checkProcessingLock(): boolean {
		if (this.presentAssistantMessageLocked) {
			this.presentAssistantMessageHasPendingUpdates = true;
			return true;
		}
		return false;
	}

	lockProcessing(): void {
		this.presentAssistantMessageLocked = true;
		this.presentAssistantMessageHasPendingUpdates = false;
	}

	unlockPresentAssistantMessage(): void {
		this.presentAssistantMessageLocked = false;
	}

	unlockProcessing(): void {
		this.presentAssistantMessageLocked = false;
	}

	toNextBlock(): void {
		this.currentBlockIndex++;
	}

	getBlockPositionState(): BlockState {
		return {
			remaining: this.currentBlockIndex < this.assistantMessageBlocks.length,
			last: this.currentBlockIndex === this.assistantMessageBlocks.length - 1,
			overLimit: this.currentBlockIndex > this.assistantMessageBlocks.length - 1
		};
	}

	shouldContinueProcessing(isThisBlockFinished: boolean): boolean {
		const blockPositionState = this.getBlockPositionState();
		return this.presentAssistantMessageHasPendingUpdates || (!!blockPositionState.remaining && isThisBlockFinished);
	}

}
