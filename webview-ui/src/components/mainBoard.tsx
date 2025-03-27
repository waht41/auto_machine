import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import ChatView from '@webview-ui/components/chat/ChatView';
import AgentStream from '@webview-ui/components/AgentStream/AgentStream';
import { vscode } from '@webview-ui/utils/vscode';
import { useExtensionState } from '@webview-ui/context/ExtensionStateContext';

interface IProp {
	onShowHistoryView: () => void;
	isChatViewHidden: boolean;
}

const MainContainer = styled.div`
	display: flex;
	width: 100%;
	height: 100vh;
`;

const ChatViewContainer = styled.div`
	flex: 6;
	height: 100%;
	border-right: 1px solid #f0f0f0;
`;

const AgentStreamContainer = styled.div`
	flex: 4;
	height: 100%;
	background-color: #fafafa;
`;

const MainBoard = (prop: IProp) => {
	const { onShowHistoryView, isChatViewHidden } = prop;
	const [showAnnouncement, setShowAnnouncement] = useState(false);
	const { shouldShowAnnouncement } = useExtensionState();
	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true);
			vscode.postMessage({ type: 'didShowAnnouncement' });
		}
	}, [shouldShowAnnouncement]);
	return (
		<MainContainer>
			<ChatViewContainer>
				<ChatView
					showHistoryView={() => {
						onShowHistoryView();
					}}
					isHidden={isChatViewHidden}
					showAnnouncement={showAnnouncement}
					hideAnnouncement={() => {
						setShowAnnouncement(false);
					}}
				/>
			</ChatViewContainer>
			<AgentStreamContainer>
				<AgentStream />
			</AgentStreamContainer>
		</MainContainer>
	);
};

export default MainBoard;