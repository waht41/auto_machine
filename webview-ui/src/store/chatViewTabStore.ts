import { create } from 'zustand';
import { TabItem } from '@webview-ui/components/navigation/TabNavigation';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import messageBus from '@webview-ui/store/messageBus';
import { BACKGROUND_MESSAGE } from '@webview-ui/store/const';
import { BackGroundMessageHandler } from '@webview-ui/store/type';

// 定义标签页存储的状态类型
interface IChatViewTabStore {
  // 状态
  activeTab: string;
  tabItems: TabItem[];
  
  // 操作方法
  setActiveTab: (activeKey: string) => void;
  setTabItems: (items: TabItem[]) => void;
  addTab: (label: string, closable?: boolean) => string; // 返回新标签的key
  closeTab: (targetKey: string) => void;
  openTab: (options: { activeKey?: string; label: string; closable?: boolean }) => string; // 返回标签的key
  
  // 辅助方法
  getActiveTab: () => string;
  getTabItems: () => TabItem[];
  getTabByKey: (key: string) => TabItem | undefined;
	
	init: () => void;
}

// 创建zustand存储
export const useChatViewTabStore = create<IChatViewTabStore>((set, get) => ({
	// 初始状态
	activeTab: '',
	tabItems: [],
  
	// 设置当前激活的标签页
	setActiveTab: (activeKey) => {
		set({ activeTab: activeKey });
		messageBus.sendToBackground({type: 'setTaskId', taskId: activeKey});
	},
  
	// 设置所有标签页
	setTabItems: (items) => set({ tabItems: items }),
  
	// 添加新标签页
	addTab: (label, closable = true) => {
		const newKey = `tab-${Date.now()}`;
		const newTab: TabItem = {
			key: newKey,
			label,
			closable,
		};
    
		set((state) => ({
			tabItems: [...state.tabItems, newTab],
			activeTab: newKey, // 自动激活新添加的标签页
		}));
    
		return newKey;
	},
  
	// 打开标签页，如果不存在则创建
	openTab: (options) => {
		const { activeKey, label, closable = true } = options;
		const state = get();
		
		// 如果没有提供 activeKey，则创建新标签页
		if (!activeKey) {
			return get().addTab(label, closable);
		}
		
		// 检查标签页是否存在
		const existingTabIndex = state.tabItems.findIndex(item => item.key === activeKey);
		
		// 如果标签页存在，更新 label 并激活它
		if (existingTabIndex !== -1) {
			// 检查 label 是否变化
			if (state.tabItems[existingTabIndex].label !== label) {
				const newTabItems = [...state.tabItems];
				newTabItems[existingTabIndex] = {
					...newTabItems[existingTabIndex],
					label
				};
				set({
					tabItems: newTabItems,
					activeTab: activeKey
				});
			} else {
				// 如果 label 没变，只激活标签页
				set({ activeTab: activeKey });
			}
			return activeKey;
		}
		
		// 如果标签页不存在，创建新标签页
		const newTab: TabItem = {
			key: activeKey,
			label,
			closable,
		};
		
		set((state) => ({
			tabItems: [...state.tabItems, newTab],
			activeTab: activeKey,
		}));
		
		return activeKey;
	},
  
	// 关闭标签页
	closeTab: (targetKey) => {
		const state = get();
		// 找到要关闭的标签页的索引
		const targetIndex = state.tabItems.findIndex(item => item.key === targetKey);
		if (targetIndex === -1) return; // 如果找不到标签页，直接返回
    
		// 创建新的标签页数组
		const newTabItems = state.tabItems.filter(item => item.key !== targetKey);
    
		// 如果关闭的是当前激活的标签页，需要激活其他标签页
		let newActiveKey = state.activeTab;
		if (targetKey === state.activeTab) {
			// 优先激活左侧标签页，如果没有左侧标签页，则激活右侧标签页
			if (targetIndex > 0) {
				newActiveKey = state.tabItems[targetIndex - 1].key;
			} else if (newTabItems.length > 0) {
				newActiveKey = newTabItems[0].key;
			} else {
				newActiveKey = ''; // 如果没有标签页了，设为空字符串
			}
		}
    
		set({
			tabItems: newTabItems,
			activeTab: newActiveKey,
		});
	},
  
	// 获取当前激活的标签页
	getActiveTab: () => get().activeTab,
  
	// 获取所有标签页
	getTabItems: () => get().tabItems,
  
	// 根据key获取标签页
	getTabByKey: (key) => get().tabItems.find(item => item.key === key),
	
	init:()=>{
		const handleExtensionMessage = (message: ExtensionMessage) => {
			switch (message.type){
				case 'openTab':  // open tab from worker, is created by history or userInput, could not be close now
					get().openTab({activeKey: message.taskId, label: message.task, closable: false});
					break;
			}
		};

		// 使用消息总线订阅扩展消息
		messageBus.on(BACKGROUND_MESSAGE, handleExtensionMessage as BackGroundMessageHandler);

		// 返回清理函数
		return () => {
			messageBus.off(BACKGROUND_MESSAGE, handleExtensionMessage as BackGroundMessageHandler);
		};
	}

}));
