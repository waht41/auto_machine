import React from 'react';
import { Button, Tooltip } from 'antd';
import styled from 'styled-components';
import { ClineMessage } from '@/shared/ExtensionMessage';
import { formatLargeNumber } from '../../utils/format';
import { ApiMetrics } from '@/shared/type';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import { colors } from '../common/styles';
import { ReactComponent as AgentStreamIcon } from '@webview-ui/assets/agentStreamIcon.svg';
import SVGComponent from '@webview-ui/components/common/SVGComponent';

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
  background-color: ${colors.backgroundPanel};
  color: ${colors.textPrimary};
  border-radius: 3px;
	border-bottom: 1px solid ${colors.borderDivider};
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  overflow: hidden;
`;

const StyledTaskText = styled.div`
  font-weight: 600;
  font-size: 20px;
  line-height: 30px;
  max-width: 30%;
	color: ${colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 400;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: 0;
	color: ${colors.textDisabled};
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
				<Tooltip title={task.text || ''} placement="bottomLeft">
					<StyledTaskText>
						{task.text || ''}
					</StyledTaskText>
				</Tooltip>
        
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
					type="text"
					onClick={handleButtonClick}
				>
					<SVGComponent component={AgentStreamIcon} stroke={showAgentStream ? colors.primary : undefined} />
				</Button>
			</RightSection>
		</HeaderContainer>
	);
};

export default TaskHeaderNew;
