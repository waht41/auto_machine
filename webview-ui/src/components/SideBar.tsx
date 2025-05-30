import React from 'react';
import { Button } from 'antd';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, HistoryOutlined, SettingOutlined, GlobalOutlined, RobotOutlined } from '@ant-design/icons';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import HistoryPreviewNew from './history/HistoryPreviewNew';
import { useExtensionState } from '../context/ExtensionStateContext';
import { colors } from './common/styles';
import NavButton from './common/NavButton';
import SVGComponent from '@webview-ui/components/common/SVGComponent';
import { ReactComponent as RooIcon } from '@webview-ui/assets/Roo.svg';

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

const LogoText = styled.div`
	font-size: 24px;
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

// 使用 styled(Button) 创建 NewTaskButton 组件
const NewTaskButton = styled(Button)`
	border-radius: 12px;
	background-color: ${colors.backgroundMuted};
	color: ${colors.primary};
	font-size: 17px;
	font-weight: 500;
	border-color: ${colors.primary};
	display: flex;
	margin-bottom: 16px;
	
	/* 覆盖父元素中的 .ant-btn 规则 */
	&&.ant-btn {
		justify-content: center;
	}

  &&.ant-btn:hover {
    background-color: ${colors.primaryHover};
  }
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
					<SVGComponent component={RooIcon} width={32} height={32}/>
					<LogoText>Roo</LogoText>
				</Logo>

				<NewTaskButton 
					type="primary" 
					icon={<PlusOutlined />} 
					size="large" 
					block
					onClick={() => {
						navigate('/');
						clearTask();
					}}
				>
					New task
				</NewTaskButton>

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
					icon={<RobotOutlined />}
					onClick={() => navigate('/assistant')}
				>
					Assistant
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
