import React from 'react';
import { Button } from 'antd';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, HistoryOutlined, SettingOutlined, GlobalOutlined } from '@ant-design/icons';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';

const SideBarContainer = styled.div`
	width: 210px;
	background-color: #fff;
	border-right: 1px solid #e8e8e8;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 16px;
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
	background-color: #1890ff;
	display: flex;
	align-items: center;
	justify-content: center;
	color: white;
	font-weight: bold;
`;

const LogoText = styled.div`
	font-size: 18px;
	font-weight: bold;
	color: #333;
`;

const SideBar: React.FC = () => {
	const navigate = useNavigate();
	const clearTask = useClineMessageStore(state => state.clearClineMessages);

	return (
		<SideBarContainer>
			<Logo>
				<LogoImage>R</LogoImage>
				<LogoText>Roo</LogoText>
			</Logo>

			<Button 
				type="primary" 
				icon={<PlusOutlined />} 
				size="large" 
				style={{ borderRadius: '8px' }}
				block
				onClick={() => {
					navigate('/');
					clearTask();
				}}
			>
				New task
			</Button>

			<Button 
				type="text" 
				icon={<GlobalOutlined />} 
				size="large" 
				block
				onClick={() => navigate('/mcp')}
			>
				MCP
			</Button>

			<Button 
				type="text" 
				icon={<HistoryOutlined />} 
				size="large" 
				block
				onClick={() => navigate('/history')}
			>
				History
			</Button>

			<Button 
				type="text" 
				icon={<SettingOutlined />} 
				size="large" 
				block
				onClick={() => navigate('/settings')}
			>
				setting
			</Button>
		</SideBarContainer>
	);
};

export default SideBar;
