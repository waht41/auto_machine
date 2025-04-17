import React, { useEffect, useRef, useCallback, useState } from 'react';
import styled from 'styled-components';
import { Card, Typography, Tag } from 'antd';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import MarkdownBlock from '@webview-ui/components/common/MarkdownBlock';
import {
	scrollToMessageById,
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
  
  /* 添加滚动过渡效果 */
  scroll-behavior: smooth;
  
  /* 为子元素添加动画效果 */
  & > div {
    transition: transform 0.3s ease-out;
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
	const virtuosoRef = useRef<VirtuosoHandle | null>(null);
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

	// 处理从ApiRequestComponent跳转过来的事件
	const handleJumpToAgentStream = useCallback((message: AgentStreamJumpState) => {
		if (message.type === AGENT_STREAM_JUMP && agentStreamMessages.length > 0) {
			if (!message.id){
				return;
			}

			const messageIndex = findMessageIndexById(agentStreamMessages, message.id);

			scrollToMessageById(virtuosoRef, agentStreamMessages, message.id);

			// 设置高亮索引，启动单次完整的淡入淡出动画
			if (messageIndex === highlightedIndex) { // 如果高亮索引和最近索引相同，需要置空然后再设置回来
				setHighlightedIndex(null);
				// 使用 requestAnimationFrame 确保状态更新后再设置回来
				requestAnimationFrame(() => {
					setHighlightedIndex(messageIndex);
				});
			} else {
				setHighlightedIndex(messageIndex);
			}
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
					followOutput='smooth'
					itemContent={(index) => {
						const item = agentStreamMessages[index];
						return (
							<ItemCard className={highlightedIndex === index ? 'highlight' : ''}>
								<MessageHeader>
									<StyledTag color="blue">
										{index + 1}
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