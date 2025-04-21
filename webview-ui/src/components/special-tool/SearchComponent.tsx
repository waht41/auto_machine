import { ComponentRenderer, SearchTool } from '@webview-ui/components/special-tool/type';
import SVGComponent from '@webview-ui/components/common/SVGComponent';
import { ReactComponent as RobotIcon } from '@webview-ui/assets/smallRobot.svg';
import { colors } from '@webview-ui/components/common/styles';

export const SearchComponent: ComponentRenderer = (tool: SearchTool) => {

	return (
		<div style={{display:'flex',flexDirection:'row', margin:'20px 0'}}>
			<div style={{marginRight: '10px'}}><SVGComponent component={RobotIcon}/></div>
			<span style={{fontSize:'17px',color:colors.textSecondary}}>{tool.complete ? 'Search Complete' : 'Searching'}</span>
		</div>
	);
};