import { headerStyle, toolIcon } from './common';
import { ComponentRenderer, LogTool } from './type';

// 日志组件
export const LogComponent: ComponentRenderer = (tool: LogTool) => {
	console.log('[waht] 开始渲染log工具');
	return (
		<>
			<div style={headerStyle}>
				{toolIcon('output')}
				<span style={{fontWeight: 'bold'}}>Roo wants to log: {tool.title}</span>
				<div>{tool.content}</div>
			</div>
		</>
	);
};