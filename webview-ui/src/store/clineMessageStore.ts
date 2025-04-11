import { create } from 'zustand';
import { ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';
import { findLastIndex } from '@/shared/array';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from '@webview-ui/store/const';
import { BackGroundMessageHandler } from '@webview-ui/store/type';
import { SharedClineMessage } from '@/shared/type';

// 定义消息存储的状态类型
interface IClineMessageStore {
	taskId: string;
  // 保持与ExtensionStateContext中相同的clineMessages结构
  clineMessages: ClineMessage[];
  
  // 操作方法
	setTaskId(taskId: string): void;
  setClineMessages: (messages: ClineMessage[]) => void;
  addClineMessage: (message: ClineMessage) => void;
  updateClineMessage: (updatedMessage: ClineMessage) => void;
  clearClineMessages: () => void;
  
  // 辅助方法
	getTask: () => string | undefined;
  getMessageById: (messageId?: number) => ClineMessage | undefined;
  getMessageByTs: (ts: number) => ClineMessage | undefined;
  getLatestMessage: () => ClineMessage | undefined;
  getLatestUserMessage: () => ClineMessage | undefined;
  getLatestAssistantMessage: () => ClineMessage | undefined;
	getChatMessages: () => ClineMessage[];
	getAgentStreamMessages: () => ClineMessage[];
  
  // 初始化方法，用于设置消息处理器
  init: () => void;
}

// 创建zustand存储
export const useClineMessageStore = create<IClineMessageStore>((set, get) => ({
	taskId: '',
	// 初始状态
	clineMessages: [],
  
	// 设置所有消息
	setClineMessages: (messages) => set({ clineMessages: messages }),
  
	// 添加单个消息
	addClineMessage: (message) => set((state) => ({
		clineMessages: [...state.clineMessages, message]
	})),
  
	// 更新特定消息（根据ts时间戳匹配）
	updateClineMessage: (updatedMessage) => set((state) => {
		const lastIndex = findLastIndex(
			state.clineMessages, 
			(msg) => msg.ts === updatedMessage.ts
		);
    
		if (lastIndex !== -1) {
			const newClineMessages = [...state.clineMessages];
			newClineMessages[lastIndex] = updatedMessage;
			return { clineMessages: newClineMessages };
		}
    
		return state; // 如果没找到匹配的消息，保持原状态不变
	}),
  
	// 清空所有消息
	clearClineMessages: () => set({ clineMessages: [] }),

	// 获取当前任务, 任务是第一天message（目前是）
	getTask: ()=> get().clineMessages.at(0)?.text,
  
	// 根据messageId获取消息
	getMessageById: (messageId) => {
		if (messageId === undefined) return undefined;
		return get().clineMessages.find(msg => msg.messageId === messageId);
	},
  
	// 根据ts获取消息
	getMessageByTs: (ts) => {
		return get().clineMessages.find(msg => msg.ts === ts);
	},
  
	// 获取最新消息
	getLatestMessage: () => {
		const messages = get().clineMessages;
		return messages.length > 0 ? messages[messages.length - 1] : undefined;
	},
  
	// 获取最新用户消息
	getLatestUserMessage: () => {
		const messages = get().clineMessages;
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].type === 'ask') {
				return messages[i];
			}
		}
		return undefined;
	},
  
	// 获取最新助手消息
	getLatestAssistantMessage: () => {
		const messages = get().clineMessages;
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].type === 'say') {
				return messages[i];
			}
		}
		return undefined;
	},

	getChatMessages: () => {
		return get().clineMessages.filter(item => item.say !== 'agent_stream');
	},

	getAgentStreamMessages: () => {
		return get().clineMessages.filter(item => item.say === 'agent_stream');
	},

	setTaskId: (taskId: string) => {
		console.log('[waht]','set taskId',taskId);
		if (get().taskId !== taskId) {
			set({ taskId });
			messageBus.sendToBackground({type: 'setTaskId', taskId});
		}
	},
  
	// 初始化方法，设置消息处理器
	init: () => {
		// 消息处理函数
		const handleExtensionMessage = (message: ExtensionMessage) => {
			switch (message.type){
				case 'setTaskId':
					set({taskId: message.taskId});
					break;
				case 'clineMessage':
					const payload = message.payload as SharedClineMessage;
					if (payload.id !== get().taskId) {
						break;
					}
					switch (payload.type) {
						case 'clineMessage': {
							if (payload.clineMessage) {
								get().setClineMessages(payload.clineMessage);
							}
							break;
						}
						case 'partialMessage': {
							const partialMessage = payload.partialMessage;
							get().updateClineMessage(partialMessage);
							break;
						}
					}
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