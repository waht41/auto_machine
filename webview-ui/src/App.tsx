import { useCallback, useEffect, useState } from 'react';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import HistoryView from './components/history/HistoryView';
import SettingsView from './components/settings/SettingsView';
import WelcomeView from './components/welcome/WelcomeView';
import { ExtensionStateContextProvider, useExtensionState } from './context/ExtensionStateContext';
import McpView from './components/mcp/McpView';
import PromptsView from './components/prompts/PromptsView';
import AssistantView from './components/assistant/AssistantView';
import { Alert, Spin } from 'antd';
import styled from 'styled-components';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Home from '@webview-ui/components/Home';
import messageBus from './store/messageBus';
import { BACKGROUND_MESSAGE } from '@webview-ui/store/const';
import { BackgroundMessage } from '@webview-ui/store/type';
import { Handler } from 'mitt';
import SideBar from './components/SideBar';
import { useStateStore } from '@webview-ui/store/stateStore';

const LoadingContainer = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	width: 100%;
`;

const ErrorContainer = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	height: 100vh;
	width: 100%;
	padding: 0 20px;
`;

const AppContainer = styled.div`
	display: flex;
	width: 100%;
	height: 100vh;
`;

const ContentContainer = styled.div`
	flex: 1;
	height: 100vh;
	overflow: auto;
`;

const AppContent = () => {
	const { didHydrateState, showWelcome } = useExtensionState();
	const navigate = useNavigate();
	const [workerError, setWorkerError] = useState<string | null>(null);

	const handleMessage = useCallback((message: ExtensionMessage) => {
		switch (message.type) {
			case 'action':
				switch (message.action!) {
					case 'settingsButtonClicked':
						navigate('/settings');
						break;
					case 'historyButtonClicked':
						navigate('/history');
						break;
					case 'mcpButtonClicked':
						navigate('/mcp');
						break;
					case 'promptsButtonClicked':
						navigate('/prompts');
						break;
					//@ts-ignore
					case 'assistantButtonClicked':
						navigate('/assistant');
						break;
					case 'chatButtonClicked':
						navigate('/');
						break;
				}
				break;
			case 'worker-error':
				if (message.error) {
					setWorkerError(message.error);
				}
				break;
		}
		console.log(message);
	}, [navigate]) as Handler<BackgroundMessage>;

	// 使用消息总线订阅扩展消息
	useEffect(() => {
		// 订阅扩展消息
		messageBus.on(BACKGROUND_MESSAGE, handleMessage);
		useStateStore.getState().init();

		// 清理函数
		return () => {
			messageBus.off(BACKGROUND_MESSAGE, handleMessage);
		};
	}, [handleMessage]);

	if (!didHydrateState) {
		if (workerError) {
			return (
				<ErrorContainer>
					<Alert
						message="background worker error"
						description={`${workerError}`}
						type="error"
						showIcon
					/>
				</ErrorContainer>
			);
		}

		return (
			<LoadingContainer>
				<Spin size="large" tip="加载中..." />
			</LoadingContainer>
		);
	}

	if (showWelcome) {
		return <WelcomeView />;
	}

	return (
		<Routes>
			<Route path="/" element={<Home/>} />
			<Route path="/settings" element={<SettingsView onDone={() => navigate('/')} />} />
			<Route path="/history" element={<HistoryView onDone={() => navigate('/')} />} />
			<Route path="/mcp" element={<McpView onDone={() => navigate('/')} />} />
			<Route path="/prompts" element={<PromptsView onDone={() => navigate('/')} />} />
			<Route path="/assistant" element={<AssistantView onDone={() => navigate('/')} />} />
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
};

const App = () => {
	useEffect(() => {
		return messageBus.init();
	}, []);

	return (
		<ExtensionStateContextProvider>
			<HashRouter>
				<AppContainer>
					<SideBar />
					<ContentContainer>
						<AppContent />
					</ContentContainer>
				</AppContainer>
			</HashRouter>
		</ExtensionStateContextProvider>
	);
};

export default App;
