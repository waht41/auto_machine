import React, { useEffect, useCallback, useState } from 'react';
import styled from 'styled-components';
import { Card, Typography, Tag, Button, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import MarkdownBlock from '@webview-ui/components/common/MarkdownBlock';
import {
	findMessageIndexById
} from '../utils/scrollSync';
import messageBus from '@webview-ui/store/messageBus';
import { AGENT_STREAM_JUMP, APP_MESSAGE } from '@webview-ui/store/const';
import { AgentStreamJumpState, AppMessageHandler } from '@webview-ui/store/type';

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
  
  /* 添加卡片动画效果 */
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
  }
  
  /* 添加滚动到视图时的高亮效果 */
  &.highlight {
    animation: highlight 2s ease-in-out;
  }
  
  @keyframes highlight {
    0% {
      background-color: #ffffff;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    }
    25% {
      background-color: rgba(24, 144, 255, 0.15);
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }
    50% {
      background-color: rgba(24, 144, 255, 0.3);
      box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.4);
    }
    75% {
      background-color: rgba(24, 144, 255, 0.15);
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }
    100% {
      background-color: #ffffff;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    }
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

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
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
  
  /* 添加滚动过渡效果 */
  scroll-behavior: smooth;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: auto;
`;

const PageButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 8px;
`;

const ScrollIndicatorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  position: relative;
  height: 30px;
`;

const ScrollTrack = styled.div`
  width: 100%;
  height: 2px;
  background-color: #f0f0f0;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const ScrollIndicator = styled.div<{ position: number }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #1890ff;
  position: absolute;
  top: 50%;
  left: ${props => props.position}%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
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

// 格式化时间戳为时:分:秒格式
const formatTimestamp = (ts: number) => {
	const date = new Date(ts);
	return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const AgentStream = () => {
	const task = useClineMessageStore().getTask();
	const agentStreamMessages = useClineMessageStore().getAgentStreamMessages();
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
	
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
	
	// 上一页
	const handlePrevPage = () => {
		if (currentPage > 1) {
			handlePageChange(currentPage - 1);
		}
	};
	
	// 下一页
	const handleNextPage = () => {
		if (currentPage < totalPages) {
			handlePageChange(currentPage + 1);
		}
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

	return (
		<StreamContainer>
			<StreamHeader>
				<TaskTitle level={4}>Agent Stream</TaskTitle>
				<TaskDescription type="secondary">{task}</TaskDescription>
			</StreamHeader>

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
				
				<PaginationContainer>
					<PageButton 
						type="primary" 
						shape="circle" 
						icon={<LeftOutlined />} 
						onClick={handlePrevPage}
						disabled={currentPage === 1}
					/>
					<PageButton 
						type="primary" 
						shape="circle" 
						icon={<RightOutlined />} 
						onClick={handleNextPage}
						disabled={currentPage === totalPages}
					/>
					<ScrollIndicatorContainer>
						<ScrollTrack />
						<Tooltip 
							title={`${currentPage} / ${totalPages}`} 
							placement="top"
						>
							<ScrollIndicator 
								position={(currentPage - 1) / Math.max(1, totalPages - 1) * 100 || 0} 
							/>
						</Tooltip>
					</ScrollIndicatorContainer>
					
				</PaginationContainer>
			</StreamBody>
		</StreamContainer>
	);
};

export default AgentStream;