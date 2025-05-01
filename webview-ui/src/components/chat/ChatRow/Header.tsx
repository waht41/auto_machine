import React from 'react';
import { cancelledColor, errorColor, normalColor, successColor } from '@webview-ui/components/common/styles';
import { ProgressIndicator } from '@webview-ui/components/chat/ChatRow/ProgressIndicator';
import { ApiStatus } from '@/shared/type';
import styled from 'styled-components';

const STATUS_CONFIG: Record<ApiStatus, {
	icon?: string;
	iconColor?: string;
	text: string;
	textColor: string;
}> = {
	cancelled: {
		icon: 'error',
		iconColor: cancelledColor,
		text: 'User Cancelled',
		textColor: normalColor,
	},
	error: {
		icon: 'error',
		iconColor: errorColor,
		text: 'Error when receiving message',
		textColor: errorColor,
	},
	completed: {
		icon: 'check',
		iconColor: successColor,
		text: 'Success',
		textColor: normalColor,
	},
	running: {
		text: 'Responding...',
		textColor: normalColor,
	},
};

export const StatusIcon = ({ status }: { status: ApiStatus }) => {
	const config = STATUS_CONFIG[status];
	return config.icon ? (
		<div className="icon-container" style={{ width: 16, height: 16 }}>
			<span
				className={`codicon codicon-${config.icon}`}
				style={{
					color: config.iconColor,
					fontSize: 16,
					marginBottom: '-1.5px',
				}}
			/>
		</div>
	) : (
		<ProgressIndicator />
	);
};

const HeaderLeft = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-grow: 1;
	font-size: 17px;
	font-weight: 600;
	//font-family: Roboto;
`;

export const StatusText = ({ status, title }: { status: ApiStatus, title?: string }) => (
	<HeaderLeft>
		{title || STATUS_CONFIG[status].text}
	</HeaderLeft>
);

export const AssistantTitle = ()=>{
	return <div style={{fontSize:'20px', fontWeight: 600, marginBottom:'10px'}}>Roo</div>;
};