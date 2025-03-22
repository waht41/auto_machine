import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { DefaultComponentProps } from './types';
import { highlightMentions } from '../../TaskHeader';
import Thumbnails from '@webview-ui/components/common/Thumbnails';
import { vscode } from '@webview-ui/utils/vscode';

/**
 * 渲染用户反馈组件
 */
export const UserFeedbackComponent = ({ message, isStreaming }: DefaultComponentProps) => {
	return (
		<div
			style={{
				backgroundColor: 'var(--vscode-badge-background)',
				color: 'var(--vscode-badge-foreground)',
				borderRadius: '3px',
				padding: '9px',
				whiteSpace: 'pre-line',
				wordWrap: 'break-word',
			}}>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '10px',
				}}>
				<span style={{ display: 'block', flexGrow: 1, padding: '4px' }}>
					{highlightMentions(message.text)}
				</span>
				<VSCodeButton
					appearance="icon"
					style={{
						padding: '3px',
						flexShrink: 0,
						height: '24px',
						marginTop: '-3px',
						marginBottom: '-3px',
						marginRight: '-6px',
					}}
					disabled={isStreaming}
					onClick={(e) => {
						e.stopPropagation();
						vscode.postMessage({
							type: 'deleteMessage',
							value: message.ts,
						});
					}}>
					<span className="codicon codicon-trash"></span>
				</VSCodeButton>
			</div>
			{message.images && message.images.length > 0 && (
				<Thumbnails images={message.images} style={{ marginTop: '8px' }} />
			)}
		</div>
	);
};
