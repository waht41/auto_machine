import React from 'react';
import { DefaultComponentProps } from './types';
import { Markdown } from '@webview-ui/components/chat/ChatRow/MarkdownBlock';

/**
 * 默认组件 - 用于处理未匹配到的消息类型
 */
export const DefaultComponent = ({ message }: DefaultComponentProps) => {

	return (
		<>
			<div style={{ paddingTop: 10 }}>
				<Markdown markdown={message.text} partial={message.partial} />
			</div>
		</>
	);
};
