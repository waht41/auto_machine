import { ComponentRenderer, SearchTool } from '@webview-ui/components/special-tool/type';
import SVGComponent from '@webview-ui/components/common/SVGComponent';
import { ReactComponent as RobotIcon } from '@webview-ui/assets/smallRobot.svg';
import { colors } from '@webview-ui/components/common/styles';
import styled from 'styled-components';

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
`;

export const SearchComponent: ComponentRenderer = (tool: SearchTool) => {

	return (
		<div style={{display:'flex',flexDirection:'row', margin:'20px 0', alignItems: 'center'}}>
			<IconWrapper><SVGComponent component={RobotIcon} width={18} height={18}/></IconWrapper>
			<span style={{fontSize:'17px',color:colors.textSecondary}}>{tool.complete ? 'Search Complete' : 'Searching'}</span>
		</div>
	);
};