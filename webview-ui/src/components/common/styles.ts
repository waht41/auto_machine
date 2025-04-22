import React from 'react';

export const colors = {
	primary: '#7C4DFF',
	primaryHover: '#9575CD',
	primaryLight: '#EDE7F6',
	primaryPress: '#9575CD',
	secondary: '#00C896',
	accent: '#FFD700',
	success: '#4CAF50',
	warning: '#FFC107',
	error: '#F44336',
	textPrimary: '#1A1A1A',
	textSecondary: '#555555',
	textPlaceholder: '#888888',
	backgroundMain: '#F9FAFB',
	backgroundPanel: '#FFFFFF',
	backgroundMuted: '#F1F3F5',
	borderDivider: '#E0E0E0'
};

export const normalColor = colors.textPrimary;
export const errorColor = colors.error;
export const successColor = colors.success;
export const cancelledColor = colors.textSecondary;

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