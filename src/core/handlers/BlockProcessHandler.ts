import { AssistantMessageContent } from '@core/assistant-message';
import cloneDeep from 'clone-deep';
import { parseBlocks } from '@core/assistant-message/parse-assistant-message';

export interface BlockState {
	remaining?: boolean,
	last?: boolean,
	overLimit?: boolean
}

export class BlockProcessHandler {
	private currentStreamingContentIndex = 0;
	private presentAssistantMessageLocked = false;
	private presentAssistantMessageHasPendingUpdates = false;
	private assistantMessageBlocks: AssistantMessageContent[] = [];
	private prevLength = 0;

	public reset() {
		this.currentStreamingContentIndex = 0;
		this.assistantMessageBlocks = [];
		this.presentAssistantMessageHasPendingUpdates = false;
		this.presentAssistantMessageLocked = false;
	}

	public setAssistantMessageBlocks(assistantMessage: string): void {
		this.prevLength = this.assistantMessageBlocks.length;
		this.assistantMessageBlocks = parseBlocks(assistantMessage);
	}

	public hasNewBlock(): boolean {
		return this.assistantMessageBlocks.length > this.prevLength;
	}

	public hasPartialBlock(): boolean {
		return this.assistantMessageBlocks.some(block => block.partial);
	}

	public getCurrentBlock(): AssistantMessageContent {
		return cloneDeep(this.assistantMessageBlocks[this.currentStreamingContentIndex]);
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

	unlockProcessing(isThisBlockFinished: boolean): void {
		this.presentAssistantMessageLocked = false;
		if (isThisBlockFinished) {
			this.currentStreamingContentIndex++; // need to increment regardless, so when read stream calls this function again it will be streaming the next block
		}
	}

	getBlockPositionState(): BlockState {
		return {
			remaining: this.currentStreamingContentIndex < this.assistantMessageBlocks.length,
			last: this.currentStreamingContentIndex === this.assistantMessageBlocks.length - 1,
			overLimit: this.currentStreamingContentIndex > this.assistantMessageBlocks.length - 1
		};
	}

	shouldContinueProcessing(isThisBlockFinished: boolean): boolean {
		const blockPositionState = this.getBlockPositionState();
		return this.presentAssistantMessageHasPendingUpdates || (!!blockPositionState.remaining && isThisBlockFinished);
	}

}
