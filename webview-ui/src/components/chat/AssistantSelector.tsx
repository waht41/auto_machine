import React from 'react';
import { useStateStore } from '@webview-ui/store/stateStore';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import styled from 'styled-components';
import { Tooltip } from 'antd';
import { colors } from '@webview-ui/components/common/styles';
import { AssistantStructure } from '@core/storage/type';

const AssistantSelectorContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const AssistantItem = styled.div<{ $isSelected: boolean }>`
  padding: 6px 12px;
  border-radius: 16px;
  background-color: ${props => props.$isSelected ? colors.primary : colors.backgroundMuted};
  color: ${props => props.$isSelected ? '#fff' : colors.textPrimary};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: ${props => props.$isSelected ? colors.primaryHover : colors.borderDivider};
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const AssistantSelector = () => {
	const assistants = useStateStore(state => state.assistants);
	const assistantName = useChatViewStore(state => state.assistantName);
	const setAssistantName = useChatViewStore(state => state.setAssistantName);
	
	const handleAssistantClick = (name: string) => {
		// 如果已选中，再次点击则取消选择
		if (assistantName === name) {
			setAssistantName(undefined);
		} else {
			setAssistantName(name);
		}
	};
	
	return (
		<AssistantSelectorContainer>
			{assistants.map((assistant: AssistantStructure) => (
				<Tooltip 
					key={assistant.name} 
					title={assistant.description || '无描述'} 
					placement="top"
				>
					<AssistantItem 
						$isSelected={assistantName === assistant.name}
						onClick={() => handleAssistantClick(assistant.name)}
					>
						{assistant.name}
					</AssistantItem>
				</Tooltip>
			))}
		</AssistantSelectorContainer>
	);
};

export default AssistantSelector;