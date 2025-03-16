import { ComponentRenderer, FollowupTool } from '@webview-ui/components/special-tool/type';
import { headerStyle, toolIcon } from '@webview-ui/components/special-tool/common';

export const FollowupComponent: ComponentRenderer = (tool: FollowupTool) => {
	return (
		<>
			<div style={headerStyle}>
				{toolIcon('question')}
				<span style={{fontWeight: 'bold'}}>Roo ask question:</span>
			</div>
			<div>{tool.question}</div>
		</>
	);
};