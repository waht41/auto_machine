import React from 'react';
import { useStateStore } from '@webview-ui/store/stateStore';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import styled from 'styled-components';
import { Button, message } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { colors } from '@webview-ui/components/common/styles';
import { AssistantStructure } from '@core/storage/type';
import messageBus from '@webview-ui/store/messageBus';
import { useNavigate } from 'react-router-dom';

const AssistantSelectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 32px;
`;

const AssistantItem = styled.div<{ $isSelected: boolean }>`
  padding: 12px 16px;
  border-radius: 8px;
  background-color: ${props => props.$isSelected ? colors.primaryLight : colors.backgroundPanel};
  border: 1px solid ${props => props.$isSelected ? colors.primary : colors.borderDivider};
  color: ${props => props.$isSelected ? colors.textPrimary : colors.textPrimary};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: ${props => props.$isSelected ? colors.primaryLight : colors.backgroundMuted};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
`;

const AssistantName = styled.div`
  font-weight: 500;
  min-width: 120px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AssistantDescription = styled.div`
  flex: 1;
  color: ${colors.textSecondary};
  margin: 0 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
`;

const ActionButton = styled(Button)`
  &:hover {
    color: ${colors.primary};
    border-color: ${colors.primary};
  }
`;

const AssistantSelector = () => {
	const assistants = useStateStore(state => state.assistants);
	const assistantId = useChatViewStore(state => state.assistantId);
	const setAssistantId = useChatViewStore(state => state.setAssistantId);
	const navigate = useNavigate();

	const handleAssistantClick = (e: React.MouseEvent, id: string) => {
		// Prevent triggering when clicking on buttons
		if ((e.target as HTMLElement).closest('.action-button')) {
			return;
		}

		// 如果已选中，再次点击则取消选择
		if (assistantId === id) {
			setAssistantId(undefined);
		} else {
			setAssistantId(id);
		}
	};

	const handleEditAssistant = (e: React.MouseEvent, assistant: AssistantStructure) => {
		e.stopPropagation();
    
		// Navigate to the assistant page with the assistant data in state
		navigate('/assistant', { state: { assistantToEdit: assistant } });
	};

	const handleDeleteAssistant = (e: React.MouseEvent, assistant: AssistantStructure) => {
		e.stopPropagation();

		if (confirm(`Are you sure you want to delete the assistant "${assistant.name}"?`)) {
			// Send delete request to background
			messageBus.sendToBackground({
				type: 'removeAssistant',
				assistantId: assistant.id
			});

			// If the deleted assistant was selected, clear the selection
			if (assistantId === assistant.id) {
				setAssistantId(undefined);
			}

			message.success(`Assistant "${assistant.name}" deleted successfully`);
		}
	};

	return (
		<AssistantSelectorContainer>
			{assistants.map((assistant: AssistantStructure) => (
				<AssistantItem
					key={assistant.id}
					$isSelected={assistantId === assistant.id}
					onClick={(e) => handleAssistantClick(e, assistant.id)}
				>
					<AssistantName>{assistant.name}</AssistantName>
					<AssistantDescription>
						{assistant.description || 'No description'}
					</AssistantDescription>
					<ButtonsContainer>
						<ActionButton
							className="action-button"
							type="text"
							icon={<EditOutlined />}
							size="small"
							onClick={(e) => handleEditAssistant(e, assistant)}
						/>
						<ActionButton
							className="action-button"
							type="text"
							icon={<DeleteOutlined />}
							size="small"
							onClick={(e) => handleDeleteAssistant(e, assistant)}
						/>
					</ButtonsContainer>
				</AssistantItem>
			))}
		</AssistantSelectorContainer>
	);
};

export default AssistantSelector;
