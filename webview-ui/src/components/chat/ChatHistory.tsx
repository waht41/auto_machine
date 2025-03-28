import { memo, useState } from 'react';
import styled from 'styled-components';
import { useExtensionState } from '../../context/ExtensionStateContext';
import HistoryPreview from '../history/HistoryPreview';
import Announcement from './Announcement';
import { useNavigate } from 'react-router-dom';

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-height: 0;
`;

const WelcomeContent = styled.div`
  max-width: 600px;
  flex-shrink: 0;
`;

const ChatHistory = () => {
	const { version, taskHistory } = useExtensionState();
	const [showAnnouncement, setShowAnnouncement] = useState(false);
	const navigate = useNavigate();

	return (
		<WelcomeContainer>
			{showAnnouncement && <Announcement version={version} hideAnnouncement={()=>{setShowAnnouncement(false);}} />}
			<WelcomeContent>
				<h2>What can I do for you?</h2>
				<p>
					Thanks to the latest breakthroughs in agentic coding capabilities, I can handle complex
					software development tasks. With tools that let me create & edit files,
					use the browser (after you grant permission). I can even use MCP to create new tools
					and extend my own capabilities.
				</p>
			</WelcomeContent>
			{taskHistory.length > 0 && <HistoryPreview showHistoryView={()=>{navigate('/history');}} />}
		</WelcomeContainer>
	);
};

export default memo(ChatHistory);