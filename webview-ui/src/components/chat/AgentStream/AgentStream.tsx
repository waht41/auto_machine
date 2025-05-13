import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Card, Tag, Typography } from 'antd';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import MarkdownBlock from '@webview-ui/components/common/MarkdownBlock';
import { findMessageIndexById } from '../utils/scrollSync';
import messageBus from '@webview-ui/store/messageBus';
import { AGENT_STREAM_JUMP, APP_MESSAGE } from '@webview-ui/store/const';
import { AgentStreamJumpState, AppMessageHandler } from '@webview-ui/store/type';
import Pagination from './Pagination';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import { CloseOutlined } from '@ant-design/icons';
import { colors } from '@webview-ui/components/common/styles';

const { Text } = Typography;

const StreamContainer = styled.div`
  padding: 20px;
  height: 95%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
`;

const TaskTitle = styled.div`
  margin-bottom: 10px;
  color: #1a1a1a;
	font-size: 22px;
`;

const StreamBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ItemCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  
  &.highlight {
    border: 2px solid #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
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

const CloseButton = styled.div<{ $marginLeft?: string }>`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textSecondary};
  transition: color 0.3s;
  margin-left: auto;
	margin-right: 10px;
  
  &:hover {
    color: ${colors.textPrimary};
  }
`;

// 格式化时间戳为时:分:秒格式
const formatTimestamp = (ts: number) => {
	const date = new Date(ts);
	return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const AgentStream = () => {
	const task = useClineMessageStore(state => state.task);
	const agentStreamMessages = useClineMessageStore(state => state.agentStreamMessages);
	const setShowAgentStream = useChatViewStore(state => state.setShowAgentStream);
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

	const showAgentStream = useChatViewStore(state => state.showAgentStream);
	const isShowAgentStream = !!task && showAgentStream;
	
	// 分页相关状态
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 1; // 每页只显示一个消息
	const totalMessages = agentStreamMessages.length;
	const totalPages = Math.ceil(totalMessages / pageSize);
	
	// 获取当前页的消息
	const getCurrentPageMessages = () => {
		const startIndex = (currentPage - 1) * pageSize;
		const endIndex = Math.min(startIndex + pageSize, totalMessages);
		return agentStreamMessages.slice(startIndex, endIndex);
	};
	
	// 页面变化处理函数
	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		setHighlightedIndex(null); // 清除高亮状态
	};
	
	// 处理从ApiRequestComponent跳转过来的事件
	const handleJumpToAgentStream = useCallback((message: AgentStreamJumpState) => {
		if (message.type === AGENT_STREAM_JUMP && agentStreamMessages.length > 0) {
			if (!message.id){
				return;
			}

			const messageIndex = findMessageIndexById(agentStreamMessages, message.id);
			if (messageIndex === -1) return;
			
			// 计算消息所在的页码 - 由于每页只有一个消息，页码就是索引+1
			const targetPage = messageIndex + 1;
			setCurrentPage(targetPage);
			
			// 设置高亮索引 - 由于每页只有一个消息，高亮索引总是0
			setHighlightedIndex(0);
		}
	}, [agentStreamMessages]) as AppMessageHandler;

	// 监听跳转事件
	useEffect(() => {
		// 使用messageBus监听APP_MESSAGE事件
		messageBus.on(APP_MESSAGE, handleJumpToAgentStream);

		return () => {
			// 组件卸载时取消监听
			messageBus.off(APP_MESSAGE, handleJumpToAgentStream);
		};
	}, [handleJumpToAgentStream]);
	
	// 当消息总数变化时，自动跳转到最后一页
	useEffect(() => {
		if (totalMessages > 0) {
			setCurrentPage(totalPages);
		}
	}, [totalMessages]);

	if (!isShowAgentStream) {
		return null;
	}

	return (
		<StreamContainer>
			<HeaderRow>
				<TaskTitle>Agent Stream</TaskTitle>
				<CloseButton onClick={() => setShowAgentStream(false)}>
					<CloseOutlined style={{ fontSize: '16px' }} />
				</CloseButton>
			</HeaderRow>

			<StreamBody>
				<MessagesContainer>
					{getCurrentPageMessages().map((item, index) => (
						<ItemCard 
							key={index} 
							className={highlightedIndex === index ? 'highlight' : ''}
						>
							<MessageHeader>
								<StyledTag color="blue">
									{(currentPage - 1) * pageSize + index + 1}
								</StyledTag>
								<TimeText type="secondary">{formatTimestamp(item.ts)}</TimeText>
							</MessageHeader>
							<MessageText markdown={item.text || ''} />
						</ItemCard>
					))}
				</MessagesContainer>
				
				<Pagination 
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={handlePageChange}
				/>
			</StreamBody>
		</StreamContainer>
	);
};

export default AgentStream;