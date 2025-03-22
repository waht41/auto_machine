import React from 'react';
import { DefaultComponentProps } from './types';
import { errorColor } from '@webview-ui/components/common/styles';

/**
 * 渲染错误组件
 */
export const ErrorComponent = ({ message }: DefaultComponentProps) => {
	return (
		<>
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				fontWeight: 'bold', 
				marginBottom: '8px' 
			}}>
				<span
					className="codicon codicon-error"
					style={{ color: errorColor, marginBottom: '-1.5px', marginRight: '8px' }}></span>
				<span style={{ color: errorColor, fontWeight: 'bold' }}>Error</span>
			</div>
			<p style={{ 
				margin: '0 0 10px 0', 
				color: 'var(--vscode-errorForeground)' 
			}}>
				{message.text}
			</p>
		</>
	);
};
