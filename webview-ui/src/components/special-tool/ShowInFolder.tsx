import { ComponentRenderer, ShowTool } from '@webview-ui/components/special-tool/type';
import { colors } from '@webview-ui/components/common/styles';
import messageBus from '@webview-ui/store/messageBus';
import { FolderOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const FolderContainer = styled.div`
  display: flex;
  flex-direction: row;
  margin: 20px 0;
  cursor: pointer;
  align-items: center;
`;

const IconWrapper = styled.div`
  margin-right: 10px;
  font-size: 20px;
  color: ${colors.primary};
`;

const FolderText = styled.span`
  font-size: 17px;
  color: ${colors.primary};
`;

export const ShowInFolderComponent: ComponentRenderer = (tool: ShowTool) => {
	return (
		<FolderContainer onClick={() => {
			messageBus.sendToElectron({type: 'openFolder', path: tool.path});
		}}>
			<IconWrapper>
				<FolderOutlined />
			</IconWrapper>
			<FolderText>Show {tool.path} In Folder</FolderText>
		</FolderContainer>
	);
};