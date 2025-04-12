import React from 'react';
import { Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useChatViewTabStore } from '@webview-ui/store/chatViewTabStore';

export interface TabItem {
  key: string;
  label: string;
  closable?: boolean;
}

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin-bottom: 0;
    padding: 0 16px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #e8e8e8;
  }

  .ant-tabs-tab {
    padding: 8px 16px;
    transition: all 0.3s;
    max-width: 160px;
    
    &:hover {
      background-color: #e6f7ff;
    }
    
    .ant-tabs-tab-btn {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
      display: inline-block;
    }
  }

  .ant-tabs-tab-active {
    background-color: #fff;
    border-bottom-color: transparent;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  
  .ant-tabs {
    flex: 1;
  }
  
  .add-tab-button {
    margin-right: 16px;
    border: none;
    background-color: transparent;
    
    &:hover {
      color: #1890ff;
      background-color: #e6f7ff;
    }
  }
`;

const TabNavigation: React.FC = () => {
	// 直接从 store 获取数据和方法
	const { 
		activeTab, 
		tabItems, 
		setActiveTab, 
		addTab, 
		closeTab 
	} = useChatViewTabStore();

	const handleTabChange = (key: string) => {
		setActiveTab(key);
		console.log('Tab changed to:', key);
	};

	const handleTabClose = (targetKey: string) => {
		console.log('Tab closed:', targetKey);
		closeTab(targetKey);
	};

	const handleTabAdd = () => {
		console.log('Add new tab');
		addTab(`新标签页 ${tabItems.length + 1}`);
	};

	return (
		<TabsContainer>
			<StyledTabs
				type="editable-card"
				activeKey={activeTab}
				onChange={handleTabChange}
				onEdit={(targetKey, action) => {
					if (action === 'add') {
						handleTabAdd();
					} else if (action === 'remove' && typeof targetKey === 'string') {
						handleTabClose(targetKey);
					}
				}}
				items={tabItems.map(item => ({
					key: item.key,
					label: item.label,
					closable: item.closable !== false, // 默认可关闭
					children: null, // 不需要内容，只需要标签
				}))}
				addIcon={<PlusOutlined />}
			/>
		</TabsContainer>
	);
};

export default TabNavigation;
