import React from 'react';
import { DefaultComponentProps } from './types';
import { Markdown } from '@webview-ui/components/chat/ChatRow/MarkdownBlock';
import { successColor } from '@webview-ui/components/common/styles';

/**
 * 渲染完成结果组件
 */
export const CompletionResultComponent = ({ message }: DefaultComponentProps) => {
	return (
		<>
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				fontWeight: 'bold', 
				marginBottom: '8px' 
			}}>
				<span
					className="codicon codicon-check"
					style={{ color: successColor, marginBottom: '-1.5px', marginRight: '8px' }}></span>
				<span style={{ color: successColor, fontWeight: 'bold' }}>Task Completed</span>
			</div>
			<div style={{ color: 'var(--vscode-charts-green)', paddingTop: 10 }}>
				<Markdown markdown={message.text} partial={message.partial} />
			</div>
		</>
	);
};
