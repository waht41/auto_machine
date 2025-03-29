import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Card, Typography, Tag } from 'antd';
import { Virtuoso } from 'react-virtuoso';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';

const { Title, Text } = Typography;

const StreamContainer = styled.div`
  padding: 16px;
  height: 90%;
  display: flex;
  flex-direction: column;
  background-color: #fafafa;
`;

const ItemCard = styled(Card)`
  margin-bottom: 24px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  border: none;
  transition: all 0.2s ease;
  background-color: #ffffff;
  overflow: hidden;
  
  &:hover {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }
  
  &:last-child {
    margin-bottom: 12px;
  }
`;

const StreamHeader = styled.div`
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TaskTitle = styled(Title)`
`;

const TaskDescription = styled(Text)`
  font-size: 14px;
`;

const StreamBody = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
`;

const StyledVirtuoso = styled(Virtuoso)`
  height: 100%;
  flex: 1;
  padding: 12px 0;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }
  
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
`;

const StyledTag = styled(Tag)`
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
`;

const TimeText = styled(Text)`
  font-size: 12px;
  opacity: 0.8;
`;

const MessageText = styled(Text)`
  display: block;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #333;
`;

// 格式化时间戳为时:分:秒格式
const formatTimestamp = (ts: number) => {
	const date = new Date(ts);
	return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const AgentStream = () => {
	const task = useClineMessageStore().getTask();
	const agentStreamMessages = useClineMessageStore().getAgentStreamMessages();
	const virtuosoRef = useRef<any>(null);

	// 当消息更新时，自动滚动到底部
	useEffect(() => {
		if (virtuosoRef.current && agentStreamMessages.length > 0) {
			virtuosoRef.current.scrollToIndex({
				index: agentStreamMessages.length - 1,
				behavior: 'smooth',
				align: 'end',
			});
		}
	}, [agentStreamMessages]);

	return (
		<StreamContainer>
			<StreamHeader>
				<TaskTitle level={4}>执行流程</TaskTitle>
				<TaskDescription type="secondary">{task}</TaskDescription>
			</StreamHeader>
      
			<StreamBody>
				<StyledVirtuoso
					ref={virtuosoRef}
					totalCount={agentStreamMessages.length}
					followOutput={true}
					itemContent={(index) => {
						const item = agentStreamMessages[index];
						return (
							<ItemCard>
								<MessageHeader>
									<StyledTag color="blue">
										{item.say === 'agent_stream' ? 'thinking' : item.say}
									</StyledTag>
									<TimeText type="secondary">{formatTimestamp(item.ts)}</TimeText>
								</MessageHeader>
								<MessageText>{item.text || ''}</MessageText>
							</ItemCard>
						);
					}}
				/>
			</StreamBody>
		</StreamContainer>
	);
};

export default AgentStream;