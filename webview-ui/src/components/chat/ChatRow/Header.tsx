import React from 'react';
import { cancelledColor, errorColor, normalColor, successColor } from '@webview-ui/components/common/styles';
import { ProgressIndicator } from '@webview-ui/components/chat/ChatRow/ProgressIndicator';

export type ChatStatus =
	| 'CANCELLED'
	| 'STREAMING_FAILED'
	| 'SUCCESS'
	| 'FAILED'
	| 'IN_PROGRESS';

const STATUS_CONFIG: Record<ChatStatus, {
	icon?: string;
	iconColor?: string;
	text: string;
	textColor: string;
}> = {
	CANCELLED: {
		icon: 'error',
		iconColor: cancelledColor,
		text: 'API Request Cancelled',
		textColor: normalColor,
	},
	STREAMING_FAILED: {
		icon: 'error',
		iconColor: errorColor,
		text: 'API Streaming Failed',
		textColor: errorColor,
	},
	SUCCESS: {
		icon: 'check',
		iconColor: successColor,
		text: 'API Request',
		textColor: normalColor,
	},
	FAILED: {
		icon: 'error',
		iconColor: errorColor,
		text: 'API Request Failed',
		textColor: errorColor,
	},
	IN_PROGRESS: {
		text: 'API Request...',
		textColor: normalColor,
	},
};

export const StatusIcon = ({ status }: { status: ChatStatus }) => {
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

export const StatusText = ({ status }: { status: ChatStatus }) => (
	<span style={{
		color: STATUS_CONFIG[status].textColor,
		fontWeight: 'bold'
	}}>
		{STATUS_CONFIG[status].text}
	</span>
);