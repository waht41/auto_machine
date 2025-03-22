import React from 'react';
import { DefaultComponentProps } from './types';
import { Markdown } from '@webview-ui/components/chat/ChatRow/MarkdownBlock';
import { normalColor } from '@webview-ui/components/common/styles';

/**
 * 渲染跟进问题组件
 */
export const FollowupComponent = ({ message }: DefaultComponentProps) => {
	return (
		<>
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				fontWeight: 'bold', 
				marginBottom: '8px' 
			}}>
				<span
					className="codicon codicon-question"
					style={{ color: normalColor, marginBottom: '-1.5px', marginRight: '8px' }}></span>
				<span style={{ color: normalColor, fontWeight: 'bold' }}>Roo has a question:</span>
			</div>
			<div style={{ paddingTop: 10 }}>
				<Markdown markdown={message.text} />
			</div>
		</>
	);
};
