import React from 'react';
import { Button } from 'antd';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, HistoryOutlined, SettingOutlined, GlobalOutlined } from '@ant-design/icons';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import HistoryPreviewNew from './history/HistoryPreviewNew';
import { useExtensionState } from '../context/ExtensionStateContext';
import { colors } from './common/styles';
import NavButton from './common/NavButton';

const SideBarContainer = styled.div`
	width: 210px;
	background-color: ${colors.backgroundMuted};
	border-right: 1px solid ${colors.borderDivider};
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	.ant-btn{
		justify-content: left;
	}
`;

const Logo = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
`;

const LogoImage = styled.div`
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background-color: ${colors.primary};
	display: flex;
	align-items: center;
	justify-content: center;
	color: ${colors.backgroundPanel};
	font-weight: bold;
`;

const LogoText = styled.div`
	font-size: 18px;
	font-weight: bold;
	color: ${colors.textPrimary};
`;

const NavigationSection = styled.div`
	flex: 0 0 auto;
	text-align: left;
`;

const HistorySection = styled.div`
	flex: 1;
	margin-top: auto;
	padding-top: 16px;
`;

const SideBar: React.FC = () => {
	const navigate = useNavigate();
	const clearTask = useClineMessageStore(state => state.clearClineMessages);
	const { taskHistory } = useExtensionState();
	
	const showHistoryView = () => {
		navigate('/history');
	};

	return (
		<SideBarContainer>
			<NavigationSection>
				<Logo>
					<LogoImage>R</LogoImage>
					<LogoText>Roo</LogoText>
				</Logo>

				<Button 
					type="primary" 
					icon={<PlusOutlined />} 
					size="large" 
					style={{ 
						borderRadius: '8px',
						backgroundColor: colors.primary,
						display: 'flex',
						justifyContent: 'center'
					}}
					block
					onClick={() => {
						navigate('/');
						clearTask();
					}}
				>
					New task
				</Button>

				<NavButton 
					icon={<GlobalOutlined />}
					onClick={() => navigate('/mcp')}
				>
					MCP
				</NavButton>

				<NavButton 
					icon={<HistoryOutlined />}
					onClick={() => navigate('/history')}
				>
					History
				</NavButton>

				<NavButton 
					icon={<SettingOutlined />}
					onClick={() => navigate('/settings')}
				>
					setting
				</NavButton>
			</NavigationSection>
			
			{taskHistory.length > 0 && (
				<HistorySection>
					<HistoryPreviewNew showHistoryView={showHistoryView} />
				</HistorySection>
			)}
		</SideBarContainer>
	);
};

export default SideBar;
