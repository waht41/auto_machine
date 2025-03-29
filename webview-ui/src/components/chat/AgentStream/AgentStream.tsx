import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Card, Timeline, Typography, Tag } from 'antd';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';

const { Title, Text } = Typography;

const StreamContainer = styled.div`
  overflow-y: auto;
  padding: 16px;
  height: 90%;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }
`;

const StreamCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const StreamHeader = styled.div`
  margin-bottom: 16px;
`;

// 格式化时间戳为时:分:秒格式
const formatTimestamp = (ts: number) => {
	const date = new Date(ts);
	return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const AgentStream = () => {
	const task = useClineMessageStore().getTask();
	const agentStreamMessages = useClineMessageStore().getAgentStreamMessages();
	const containerRef = useRef<HTMLDivElement>(null);

	// 当消息更新时，自动滚动到底部
	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [agentStreamMessages]);

	return (
		<StreamContainer ref={containerRef}>
			<StreamHeader>
				<Title level={4}>执行流程</Title>
				<Text type="secondary">{task}</Text>
			</StreamHeader>
      
			<StreamCard>
				<Timeline>
					{agentStreamMessages.map((item, index) => (
						<Timeline.Item key={item.ts || index} color="blue">
							<div>
								<Tag color="blue">
									{item.say === 'agent_stream' ? 'thinking' : item.say}
								</Tag>
								<Text type="secondary" style={{ fontSize: '12px' }}>{formatTimestamp(item.ts)}</Text>
							</div>
							<div style={{ marginTop: '8px' }}>
								<Text>{item.text || ''}</Text>
							</div>
						</Timeline.Item>
					))}
				</Timeline>
			</StreamCard>
		</StreamContainer>
	);
};

export default AgentStream;