import React, { useState } from 'react';
import ReasoningBlock from '../../ReasoningBlock';
import { DefaultComponentProps } from './types';

/**
 * 渲染推理块组件
 */
export const ReasoningComponent = ({ message }: DefaultComponentProps) => {
	const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

	return (
		<ReasoningBlock
			content={message.text || ''}
			isCollapsed={reasoningCollapsed}
			onToggleCollapse={() => setReasoningCollapsed(!reasoningCollapsed)}
		/>
	);
};
