import React from 'react';
import { Button, Typography } from 'antd';
import styled from 'styled-components';
import { ClineMessage } from '@/shared/ExtensionMessage';
import { formatLargeNumber } from '../../utils/format';
import { ApiMetrics } from '@/shared/type';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';

interface TaskHeaderNewProps {
  task: ClineMessage;
  apiMetrics: ApiMetrics;
}

// 样式定义
const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 13px;
  background-color: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 3px;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const StyledTaskText = styled(Typography.Text)`
  font-family: Roboto;
  font-weight: 500;
  font-size: 20px;
  line-height: 30px;
  letter-spacing: 0%;
  max-width: 300px;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: Roboto;
  font-weight: 400;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: 0%;
`;

const Label = styled.span`
  font-weight: bold;
`;

const Value = styled.span`
  margin-left: 4px;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
`;

const TaskHeaderNew: React.FC<TaskHeaderNewProps> = ({ task, apiMetrics }) => {
	const { totalCost, totalTokensIn: tokensIn, totalTokensOut: tokensOut, contextTokens } = apiMetrics;
	const { showAgentStream, toggleAgentStream } = useChatViewStore();

	const handleButtonClick = () => {
		toggleAgentStream();
	};

	return (
		<HeaderContainer>
			<LeftSection>
				<StyledTaskText
					ellipsis={{ 
						tooltip: task.text || ''
					}}
				>
					{task.text || ''}
				</StyledTaskText>
        
				<InfoItem>
					<Label>Tokens:</Label>
					<Value>
						<i className="codicon codicon-arrow-up" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '-2px' }} />
						{formatLargeNumber(tokensIn || 0)}
						<i className="codicon codicon-arrow-down" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '-2px', marginLeft: '5px' }} />
						{formatLargeNumber(tokensOut || 0)}
					</Value>
				</InfoItem>
        
				<InfoItem>
					<Label>Context:</Label>
					<Value>{contextTokens ? formatLargeNumber(contextTokens) : '-'}</Value>
				</InfoItem>
        
				<InfoItem>
					<Label>API Cost:</Label>
					<Value>${totalCost?.toFixed(4) || '0.0000'}</Value>
				</InfoItem>
			</LeftSection>
      
			<RightSection>
				<Button 
					type="primary" 
					onClick={handleButtonClick}
					style={{ 
						backgroundColor: 'var(--vscode-button-background)',
						borderColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)'
					}}
				>
					{showAgentStream ? '隐藏Agent流' : '显示Agent流'}
				</Button>
			</RightSection>
		</HeaderContainer>
	);
};

export default TaskHeaderNew;
