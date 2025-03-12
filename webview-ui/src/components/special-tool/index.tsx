import React from 'react';
import { renderTool } from './router';
import { Tool } from './type';

// 主渲染函数
export const renderSpecialTool = (newTool: Tool): React.ReactNode => {
	return renderTool(newTool);
};

export default renderSpecialTool;