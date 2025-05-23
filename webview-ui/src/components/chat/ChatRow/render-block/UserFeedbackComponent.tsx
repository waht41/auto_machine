import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { DefaultComponentProps } from './types';
import Thumbnails from '@webview-ui/components/common/Thumbnails';
import { vscode } from '@webview-ui/utils/vscode';
import styled from 'styled-components';

/**
 * 样式组件定义
 */
const FeedbackContainer = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	width: 100%;
`;

const ContentWrapper = styled.div`
	display: flex;
	width: 100%;
	justify-content: flex-end;
	align-items: flex-start;
`;

const TextContent = styled.div`
  max-width: 60%;
  padding: 16px 24px;
  border-radius: 22px 4px 22px 22px;
  background: linear-gradient(0deg, rgba(146, 51, 255, 0.1), rgba(146, 51, 255, 0.1));
	font-size: 17px;
  white-space: pre-line;
  word-wrap: break-word;
  word-break: break-word;
  text-align: right;
`;

const DeleteButton = styled(VSCodeButton)`
	padding: 3px;
	flex-shrink: 0;
	height: 24px;
	margin-top: 13px;
	margin-left: 8px;
	display: none;
`;

const ThumbnailsWrapper = styled(Thumbnails)`
	margin-top: 8px;
	width: 100%;
`;

/**
 * 渲染用户反馈组件
 */
export const UserFeedbackComponent = ({ message, isStreaming }: DefaultComponentProps) => {
	return (
		<FeedbackContainer>
			<ContentWrapper>
				<TextContent>
					{message.text}
				</TextContent>
				<DeleteButton
					appearance="icon"
					disabled={isStreaming}
					onClick={(e: React.MouseEvent<HTMLElement>) => {
						e.stopPropagation();
						vscode.postMessage({
							type: 'deleteMessage',
							value: message.ts,
						});
					}}>
					<span className="codicon codicon-trash"></span>
				</DeleteButton>
			</ContentWrapper>
			{message.images && message.images.length > 0 && (
				<ThumbnailsWrapper images={message.images} />
			)}
		</FeedbackContainer>
	);
};
