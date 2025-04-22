import { ComponentRenderer, ApprovalTool } from './type';
import yaml from 'js-yaml';
import MarkdownBlock from '../common/MarkdownBlock';
import { vscode } from '@webview-ui/utils/vscode';
import { Button, Space, Typography } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';
import { colors } from '@webview-ui/components/common/styles';

// 样式组件
const ApprovalCard = styled.div`
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 32px;
	margin-top: 16px;
`;

const HeaderContainer = styled.div`
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Title = styled.div`
`;

const ContentContainer = styled.div`
  margin-bottom: 16px;
`;

const ButtonContainer = styled(Space)`
  display: flex;
  justify-content: flex-end;
`;

const WarningText = styled(Typography.Text)`
  color: #faad14;
`;

// 审批组件
export const AskApprovalComponent: ComponentRenderer = (tool: ApprovalTool) => {
	console.log('[waht]', tool);
	const [showButtons, setShowButtons] = useState(true);
	const [responseMessage, setResponseMessage] = useState('');

	const handleApproval = () => {
		vscode.postMessage({
			type: 'userApproval',
			payload: {tool: {type: 'approval', content: tool.content}}
		});
		setShowButtons(false);
	};

	const handleDeny = () => {
		setResponseMessage('You have denied this tool');
		setShowButtons(false);
	};

	return (
		<ApprovalCard>
			<HeaderContainer>
				<Title>Roo ask approval:</Title>
			</HeaderContainer>
			
			<ContentContainer>
				<MarkdownBlock markdown={'```yaml\n' + yaml.dump(tool.content) + '```'}></MarkdownBlock>
			</ContentContainer>
			
			{showButtons ? (
				<ButtonContainer>
					<Button type="default" onClick={handleDeny}>No</Button>
					<Button type="primary" onClick={handleApproval} style={{ background: colors.primary}}>OK</Button>
				</ButtonContainer>
			) : (
				responseMessage && <WarningText>{responseMessage}</WarningText>
			)}
		</ApprovalCard>
	);
};