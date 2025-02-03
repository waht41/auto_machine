import { useCallback, useEffect, useState } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../src/shared/ExtensionMessage"
import ChatView from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import { vscode } from "./utils/vscode"
import McpView from "./components/mcp/McpView"
import PromptsView from "./components/prompts/PromptsView"

const AppContent = () => {
	const { didHydrateState, showWelcome, shouldShowAnnouncement } = useExtensionState()
	const [showSettings, setShowSettings] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showMcp, setShowMcp] = useState(false)
	const [showPrompts, setShowPrompts] = useState(false)
	const [showAnnouncement, setShowAnnouncement] = useState(false)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "action":
				switch (message.action!) {
					case "settingsButtonClicked":
						setShowSettings(true)
						setShowHistory(false)
						setShowMcp(false)
						setShowPrompts(false)
						break
					case "historyButtonClicked":
						setShowSettings(false)
						setShowHistory(true)
						setShowMcp(false)
						setShowPrompts(false)
						break
					case "mcpButtonClicked":
						setShowSettings(false)
						setShowHistory(false)
						setShowMcp(true)
						setShowPrompts(false)
						break
					case "promptsButtonClicked":
						setShowSettings(false)
						setShowHistory(false)
						setShowMcp(false)
						setShowPrompts(true)
						break
					case "chatButtonClicked":
						setShowSettings(false)
						setShowHistory(false)
						setShowMcp(false)
						setShowPrompts(false)
						break
				}
				break
		}
	}, [])

	useEvent("message", handleMessage)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement])

	// if (!didHydrateState) {
	// 	return null
	// }

	// return (
	// 	<>
	// 		{showWelcome ? (
	// 			<WelcomeView />
	// 		) : (
	// 			<>
	// 				{showSettings && <SettingsView onDone={() => setShowSettings(false)} />}
	// 				{showHistory && <HistoryView onDone={() => setShowHistory(false)} />}
	// 				{showMcp && <McpView onDone={() => setShowMcp(false)} />}
	// 				{showPrompts && <PromptsView onDone={() => setShowPrompts(false)} />}
	// 				{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
	// 				<ChatView
	// 					showHistoryView={() => {
	// 						setShowSettings(false)
	// 						setShowMcp(false)
	// 						setShowPrompts(false)
	// 						setShowHistory(true)
	// 					}}
	// 					isHidden={showSettings || showHistory || showMcp || showPrompts}
	// 					showAnnouncement={showAnnouncement}
	// 					hideAnnouncement={() => {
	// 						setShowAnnouncement(false)
	// 					}}
	// 				/>
	// 			</>
	// 		)}
	// 	</>
	// )
}

const App = () => {
	useEvent('message',(arg)=>{
		console.log('[waht] message',arg)
	})
	useEffect(() => {
		window.electronApi.on('message', (data) => {
			console.log('[waht]', 'center', data);
			try {
				const targetOrigin = window.location.origin;
				window.postMessage(data, targetOrigin);
			} catch (error) {
				console.error('Failed to process message when transport message', error);
			}
		});
	}, []);
	return (<div>
		hello world
	</div>)

	// return (
	// 	<ExtensionStateContextProvider>
	// 		<AppContent />
	// 	</ExtensionStateContextProvider>
	// )
}

export default App
