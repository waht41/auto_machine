import { useCallback, useEffect } from 'react';
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
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Home from '@webview-ui/components/Home';

const LoadingContainer = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	width: 100%;
`;

const AppContent = () => {
	const { didHydrateState, showWelcome } = useExtensionState();
	const navigate = useNavigate();
	const location = useLocation();

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data;
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
					case 'chatButtonClicked':
						navigate('/');
						break;
				}
				break;
		}
	}, [navigate]);

	useEvent('message', handleMessage);

	if (!didHydrateState) {
		return (
			<LoadingContainer>
				<Spin size="large" tip="加载中..." />
			</LoadingContainer>
		);
	}

	if (showWelcome) {
		return <WelcomeView />;
	}

	// 判断当前路由是否是聊天页面之外的页面
	const isChatViewHidden = location.pathname !== '/';

	return (
		<Routes>
			<Route path="/" element={<Home isChatViewHidden={isChatViewHidden}/>} />
			<Route path="/settings" element={<SettingsView onDone={() => navigate('/')} />} />
			<Route path="/history" element={<HistoryView onDone={() => navigate('/')} />} />
			<Route path="/mcp" element={<McpView onDone={() => navigate('/')} />} />
			<Route path="/prompts" element={<PromptsView onDone={() => navigate('/')} />} />
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
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
			<HashRouter>
				<AppContent />
			</HashRouter>
		</ExtensionStateContextProvider>
	);
};

export default App;
