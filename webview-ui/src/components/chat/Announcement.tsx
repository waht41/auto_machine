import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { memo } from 'react';
// import VSCodeButtonLink from "./VSCodeButtonLink"
// import { getOpenRouterAuthUrl } from "./ApiOptions"
// import { vscode } from "../utils/vscode"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}
/*
You must update the latestAnnouncementId in ClineProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ hideAnnouncement }: AnnouncementProps) => {
	return (
		<div
			style={{
				backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
				borderRadius: '3px',
				padding: '12px 16px',
				margin: '5px 15px 5px 15px',
				position: 'relative',
				flexShrink: 0,
			}}>
			<VSCodeButton
				appearance="icon"
				onClick={hideAnnouncement}
				style={{ position: 'absolute', top: '8px', right: '8px' }}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h1>Welcome to Auto Machine</h1>
			<p>Auto Machine, an AI-powered assistant built on Roo Code, is currently in beta testing and under active
				development.</p>
			<p>Feel free to test the current features and share your feedback via the <a
				href="https://github.com/waht41/auto_machine" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
				Your insights will directly guide this project's evolution.</p>
		</div>
	);
};

export default memo(Announcement);
