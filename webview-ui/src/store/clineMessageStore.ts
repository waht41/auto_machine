import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createListeners } from './createDerivedState';
import { ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';
import { findLastIndex } from '@/shared/array';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from '@webview-ui/store/const';
import { BackGroundMessageHandler } from '@webview-ui/store/type';
import { SharedClineMessage } from '@/shared/type';
import { ReplyContent } from '@webview-ui/components/chat/type';

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
  getMessageById: (messageId?: number) => ClineMessage | undefined;
  getMessageByTs: (ts: number) => ClineMessage | undefined;
  
  // 监听变量（派生状态）
  task: string | undefined;
  latestMessage: ClineMessage | undefined;
  latestUserMessage: ClineMessage | undefined;
  latestAssistantMessage: ClineMessage | undefined;
  chatMessages: ClineMessage[];
  agentStreamMessages: ClineMessage[];
  showedMessages: ReplyContent[];
  
  // 初始化方法，用于设置消息处理器
  init: () => void;
}

// 创建zustand存储
export const useClineMessageStore = create<IClineMessageStore>()(
	subscribeWithSelector((set, get) => ({
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
  

  
		// 根据messageId获取消息
		getMessageById: (messageId) => {
			if (messageId === undefined) return undefined;
			return get().clineMessages.find(msg => msg.messageId === messageId);
		},
  
		// 根据ts获取消息
		getMessageByTs: (ts) => {
			return get().clineMessages.find(msg => msg.ts === ts);
		},
  
		// 监听变量的初始值
		task: undefined,
		latestMessage: undefined,
		latestUserMessage: undefined,
		latestAssistantMessage: undefined,
		chatMessages: [],
		agentStreamMessages: [],
		showedMessages: [],
  
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
	}))
);

// 设置监听器配置
createListeners<IClineMessageStore>(
	[
		// task 监听 clineMessages
		{
			target: 'task',
			sources: 'clineMessages',
			compute: (current) => {
				return current.clineMessages.at(0)?.text;
			}
		},
		
		// latestMessage 监听 clineMessages
		{
			target: 'latestMessage',
			sources: 'clineMessages',
			compute: (current) => {
				const messages = current.clineMessages;
				return messages.length > 0 ? messages[messages.length - 1] : undefined;
			}
		},
    
		// latestUserMessage 监听 clineMessages
		{
			target: 'latestUserMessage',
			sources: 'clineMessages',
			compute: (current) => {
				const messages = current.clineMessages;
				for (let i = messages.length - 1; i >= 0; i--) {
					if (messages[i].type === 'ask') {
						return messages[i];
					}
				}
				return undefined;
			}
		},
    
		// latestAssistantMessage 监听 clineMessages
		{
			target: 'latestAssistantMessage',
			sources: 'clineMessages',
			compute: (current) => {
				const messages = current.clineMessages;
				for (let i = messages.length - 1; i >= 0; i--) {
					if (messages[i].type === 'say') {
						return messages[i];
					}
				}
				return undefined;
			}
		},
    
		// chatMessages 监听 clineMessages
		{
			target: 'chatMessages',
			sources: 'clineMessages',
			compute: (current) => {
				return current.clineMessages.filter(item => item.say !== 'agent_stream');
			}
		},
    
		// agentStreamMessages 监听 clineMessages
		{
			target: 'agentStreamMessages',
			sources: 'clineMessages',
			compute: (current) => {
				return current.clineMessages.filter(item => item.say === 'agent_stream');
			}
		},
    
		// showedMessages 监听 clineMessages
		{
			target: 'showedMessages',
			sources: 'clineMessages',
			compute: (current) => {
				const replies: ReplyContent[] = [];
				let currentGroup: ClineMessage[] = [];

				// 辅助函数：添加当前消息组到结果中
				const addCurrentGroup = () => {
					if (currentGroup.length > 0) {
						// 如果当前组只有一个消息，直接添加该消息
						if (currentGroup.length === 1) {
							replies.push(currentGroup[0]);
						}
						// 如果当组有两条消息且第一条是 api_req_started 时，分别添加两条消息
						else if (currentGroup.length === 2 && currentGroup[0].say === 'api_req_started') {
							replies.push(currentGroup[0]);
							replies.push(currentGroup[1]);
						}
						// 其他情况，添加为数组
						else {
							replies.push(currentGroup);
						}
						currentGroup = [];
					}
				};

				const chatMessages = current.clineMessages.filter(item => item.say !== 'agent_stream');
      
				for (const message of chatMessages.slice(1)) {
					if (message.say === 'text' || message.say === 'tool' || message.say === 'api_req_started' || message.ask === 'tool') {
						currentGroup.push(message);
					} else {
						addCurrentGroup();
						replies.push(message);
					}
				}

				addCurrentGroup();

				return replies.filter((message) => {
					// 如果是消息数组，始终显示
					if (Array.isArray(message)) {
						return true;
					}

					// 对单个消息进行过滤
					if (message.say === 'text') {
						// Sometimes cline returns an empty text message, we don't want to render these. (We also use a say text for user messages, so in case they just sent images we still render that)
						if ((message.text ?? '') === '' && (message.images?.length ?? 0) === 0) {
							return false;
						}
					}
					return true;
				});
			}
		}
	],
	useClineMessageStore
);