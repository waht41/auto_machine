import React, { useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import ChatView from '@webview-ui/components/chat/ChatView';
import AgentStream from '@webview-ui/components/chat/AgentStream/AgentStream';
import TaskHeader from '@webview-ui/components/chat/TaskHeader';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import { useChatViewTabStore } from '@webview-ui/store/chatViewTabStore';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import { getApiMetrics } from '@/shared/getApiMetrics';

const MainContainer = styled.div`
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100vh;
`;

const HeaderContainer = styled.div`
	width: 100%;
	padding: 0;
`;

const ContentContainer = styled.div`
	display: flex;
	width: 100%;
	flex: 1;
	overflow: hidden;
`;

const ChatViewContainer = styled.div<{ $hasTask: boolean }>`
	flex: ${props => props.$hasTask ? 6 : 10};
	height: 100%;
	border-right: ${props => props.$hasTask ? '1px solid #f0f0f0' : 'none'};
	transition: flex 0.5s ease;
`;

const slideInAnimation = keyframes`
  0% {
    opacity: 0;
    transform: translateX(100%);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const AgentStreamContainer = styled.div<{ $isShow: boolean }>`
	display: ${props => props.$isShow ? undefined : 'none'};
	flex: 4;
	height: 100%;
	background-color: #fafafa;
	animation: ${slideInAnimation} 0.6s ease;
	overflow: hidden;
`;

const MainBoard = () => {
	const clineMessages = useClineMessageStore(state => state.clineMessages);
	const task = useClineMessageStore(state => state.task);
	const showAgentStream = useChatViewStore(state => state.showAgentStream);
	const isShowAgentStream = !!task && showAgentStream;


	// 计算 API 指标
	const apiMetrics = useMemo(() => getApiMetrics(clineMessages), [clineMessages]);

	// 初始化clineMessageStore
	useEffect(() => {
		// 初始化clineMessageStore，让它自己处理消息
		useClineMessageStore.getState().init();
		useChatViewTabStore.getState().init();
	}, []);


	return (
		<MainContainer>
			{!!task && (
				<HeaderContainer>
					<TaskHeader
						task={{
							type: 'ask',
							text: task,
							ts: clineMessages[0]?.ts || Date.now(),
							messageId: clineMessages[0]?.messageId || 0
						}}
						apiMetrics={apiMetrics}
					/>
				</HeaderContainer>
			)}
			<ContentContainer>
				<ChatViewContainer $hasTask={isShowAgentStream}>
					<ChatView />
				</ChatViewContainer>
				<AgentStreamContainer $isShow={isShowAgentStream}>
					<AgentStream />
				</AgentStreamContainer>
			</ContentContainer>
		</MainContainer>
	);
};

export default MainBoard;
