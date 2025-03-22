import React from 'react';

export const normalColor = 'var(--vscode-foreground)';
export const errorColor = 'var(--vscode-errorForeground)';
export const successColor = 'var(--vscode-charts-green)';
export const cancelledColor = 'var(--vscode-descriptionForeground)';

export const headerStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '10px',
	marginBottom: '10px',
};

export const pStyle: React.CSSProperties = {
	margin: 0,
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
	overflowWrap: 'anywhere',
};