import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import ChatView from '@webview-ui/components/chat/ChatView';
import AgentStream from '@webview-ui/components/chat/AgentStream/AgentStream';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import { useChatViewTabStore } from '@webview-ui/store/chatViewTabStore';

const MainContainer = styled.div`
	display: flex;
	width: 100%;
	height: 100vh;
`;

const ChatViewContainer = styled.div<{ hasTask: boolean }>`
	flex: ${props => props.hasTask ? 6 : 10};
	height: 100%;
	border-right: ${props => props.hasTask ? '1px solid #f0f0f0' : 'none'};
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

const AgentStreamContainer = styled.div`
	flex: 4;
	height: 100%;
	background-color: #fafafa;
	animation: ${slideInAnimation} 0.6s ease;
	overflow: hidden;
`;

const MainBoard = () => {
	const task = useClineMessageStore().getTask();
	const hasTask = !!task;

	// 初始化clineMessageStore
	useEffect(() => {
		// 初始化clineMessageStore，让它自己处理消息
		useClineMessageStore.getState().init();
		useChatViewTabStore.getState().init();
	}, []);


	return (
		<MainContainer>
			<ChatViewContainer hasTask={hasTask}>
				<ChatView />
			</ChatViewContainer>
			{hasTask && (
				<AgentStreamContainer>
					<AgentStream />
				</AgentStreamContainer>
			)}
		</MainContainer>
	);
};

export default MainBoard;