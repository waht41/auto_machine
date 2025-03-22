import deepEqual from 'fast-deep-equal';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useSize } from 'react-use';
import { ClineMessage, ClineSayTool } from '@/shared/ExtensionMessage';
import renderSpecialTool from '../../special-tool';
import { Tool } from '../../special-tool/type';
import { renderMessage } from '@webview-ui/components/chat/ChatRow/render-block/router';

interface ChatRowProps {
	message: ClineMessage
	isExpanded: boolean
	onToggleExpand: () => void
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
}

export type ChatRowContentProps = Omit<ChatRowProps, 'onHeightChange'>

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props;
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0);

		const [chatrow, { height }] = useSize(
			<div
				style={{
					padding: '10px 6px 10px 15px',
				}}>
				<ChatRowContent {...props} />
			</div>,
		);

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0; // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current);
				}
				prevHeightRef.current = height;
			}
		}, [height, isLast, onHeightChange, message]);

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow;
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
);

export default ChatRow;

export const ChatRowContent = (prop: ChatRowContentProps) => {
	const {message} = prop;

	const tool = useMemo(() => {
		if (message.ask === 'tool' || message.say === 'tool') {
			return JSON.parse(message.text || '{}') as ClineSayTool;
		}
		return null;
	}, [message.ask, message.say, message.text]);

	if (tool) {
		return renderSpecialTool(tool as unknown as Tool);
	}

	return renderMessage(prop);
};