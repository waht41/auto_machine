import { useCallback, useEffect, useState } from 'react';
import { useEvent } from 'react-use';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import HistoryView from './components/history/HistoryView';
import SettingsView from './components/settings/SettingsView';
import WelcomeView from './components/welcome/WelcomeView';
import { ExtensionStateContextProvider, useExtensionState } from './context/ExtensionStateContext';
import McpView from './components/mcp/McpView';
import PromptsView from './components/prompts/PromptsView';
import { Spin } from 'antd';
import styled from 'styled-components';
import MainBoard from '@webview-ui/components/mainBoard';

const LoadingContainer = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	width: 100%;
`;

const AppContent = () => {
	const { didHydrateState, showWelcome } = useExtensionState();
	const [showSettings, setShowSettings] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showMcp, setShowMcp] = useState(false);
	const [showPrompts, setShowPrompts] = useState(false);

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data;
		switch (message.type) {
			case 'action':
				switch (message.action!) {
					case 'settingsButtonClicked':
						setShowSettings(true);
						setShowHistory(false);
						setShowMcp(false);
						setShowPrompts(false);
						break;
					case 'historyButtonClicked':
						setShowSettings(false);
						setShowHistory(true);
						setShowMcp(false);
						setShowPrompts(false);
						break;
					case 'mcpButtonClicked':
						setShowSettings(false);
						setShowHistory(false);
						setShowMcp(true);
						setShowPrompts(false);
						break;
					case 'promptsButtonClicked':
						setShowSettings(false);
						setShowHistory(false);
						setShowMcp(false);
						setShowPrompts(true);
						break;
					case 'chatButtonClicked':
						setShowSettings(false);
						setShowHistory(false);
						setShowMcp(false);
						setShowPrompts(false);
						break;
				}
				break;
		}
	}, []);

	useEvent('message', handleMessage);



	if (!didHydrateState) {
		return (
			<LoadingContainer>
				<Spin size="large" tip="加载中..." />
			</LoadingContainer>
		);
	}

	return (
		<>
			{showWelcome ? (
				<WelcomeView />
			) : (
				<>
					{showSettings && <SettingsView onDone={() => setShowSettings(false)} />}
					{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
					{showMcp && <McpView onDone={() => setShowMcp(false)} />}
					{showPrompts && <PromptsView onDone={() => setShowPrompts(false)} />}
					{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
					<MainBoard
						onShowHistoryView={() => {
							setShowSettings(false);
							setShowMcp(false);
							setShowPrompts(false);
							setShowHistory(true);
						}}
						isChatViewHidden={showSettings || showHistory || showMcp || showPrompts} />
				</>
			)}
		</>
	);
};

const App = () => {
	useEffect(() => {
		window.electronApi.on('message', (data) => {
			try {
				const targetOrigin = window.location.origin;
				window.postMessage(data, targetOrigin);
			} catch (error) {
				console.error('Failed to process message when transport message', error);
			}
		});
		window.electronApi.send('message', 'webview ready');
	}, []);

	return (
		<ExtensionStateContextProvider>
			<AppContent />
		</ExtensionStateContextProvider>
	);
};

export default App;
