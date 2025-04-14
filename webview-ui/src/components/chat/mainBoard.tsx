import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import ChatView from '@webview-ui/components/chat/ChatView';
import AgentStream from '@webview-ui/components/chat/AgentStream/AgentStream';
import { vscode } from '@webview-ui/utils/vscode';
import { useExtensionState } from '@webview-ui/context/ExtensionStateContext';
import { useNavigate } from 'react-router-dom';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import { useChatViewTabStore } from '@webview-ui/store/chatViewTabStore';

interface IProp {
	isChatViewHidden: boolean;
}

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

const MainBoard = (prop: IProp) => {
	const { isChatViewHidden } = prop;
	const [showAnnouncement, setShowAnnouncement] = useState(false);
	const { shouldShowAnnouncement } = useExtensionState();
	const navigate = useNavigate();
	const task = useClineMessageStore().getTask();
	const hasTask = !!task;

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true);
			vscode.postMessage({ type: 'didShowAnnouncement' });
		}
	}, [shouldShowAnnouncement]);

	// 初始化clineMessageStore
	useEffect(() => {
		// 初始化clineMessageStore，让它自己处理消息
		useClineMessageStore.getState().init();
		useChatViewTabStore.getState().init();
	}, []);

	return (
		<MainContainer>
			<ChatViewContainer hasTask={hasTask}>
				<ChatView
					showHistoryView={() => {
						navigate('/history');
					}}
					isHidden={isChatViewHidden}
					showAnnouncement={showAnnouncement}
					hideAnnouncement={() => {
						setShowAnnouncement(false);
					}}
				/>
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