import React from 'react';
import { DefaultComponentProps } from './types';
import { Markdown } from '@webview-ui/components/chat/ChatRow/MarkdownBlock';

/**
 * 渲染文本组件
 */
export const TextComponent = ({ message }: DefaultComponentProps) => {
	// 文本组件不需要特殊的标题和图标，直接渲染内容
	return (
		<div>
			<Markdown markdown={message.text} partial={message.partial} />
		</div>
	);
};
