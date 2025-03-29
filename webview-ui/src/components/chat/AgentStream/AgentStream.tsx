import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Card, Typography, Tag } from 'antd';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import MarkdownBlock from '@webview-ui/components/common/MarkdownBlock';

const { Title, Text } = Typography;

const StreamContainer = styled.div`
  padding: 20px;
  height: 95%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
`;

const ItemCard = styled(Card)`
  margin-bottom: 32px;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  border: none;
  background-color: #ffffff;
  overflow: hidden;
  
  &:last-child {
    margin-bottom: 16px;
  }
`;

const StreamHeader = styled.div`
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px;
`;

const TaskTitle = styled(Title)`
  margin-bottom: 0 !important;
  color: #1a1a1a;
`;

const TaskDescription = styled(Text)`
  font-size: 14px;
  color: #666;
`;

const StreamBody = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
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
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 10px;
`;

const StyledTag = styled(Tag)`
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  text-transform: uppercase;
`;

const TimeText = styled(Text)`
  font-size: 12px;
  opacity: 0.7;
  margin-left: auto;
`;

const MessageText = styled(MarkdownBlock)`
  display: block;
  line-height: 1.8;
  white-space: pre-wrap;
  color: #262626;
  font-size: 14px;
  padding: 0 4px;
`;

// 格式化时间戳为时:分:秒格式
const formatTimestamp = (ts: number) => {
	const date = new Date(ts);
	return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const AgentStream = () => {
	const task = useClineMessageStore().getTask();
	const agentStreamMessages = useClineMessageStore().getAgentStreamMessages();
	const virtuosoRef = useRef<VirtuosoHandle | null>(null);

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
				<TaskTitle level={4}>Agent Stream</TaskTitle>
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
								<MessageText markdown={item.text || ''} />
							</ItemCard>
						);
					}}
				/>
			</StreamBody>
		</StreamContainer>
	);
};

export default AgentStream;