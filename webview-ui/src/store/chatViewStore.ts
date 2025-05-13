import { create } from 'zustand';
import { ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';
import { findLast } from '@/shared/array';
import { useClineMessageStore } from './clineMessageStore';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from './const';
import { BackGroundMessageHandler } from './type';

// 定义聊天视图存储的状态类型
interface IChatViewStore {
  // 输入和交互状态
  inputValue: string;
  textAreaDisabled: boolean;
  selectedImages: string[];
  didClickCancel: boolean;
  
  // 滚动和展示状态
  showScrollToBottom: boolean;
  isAtBottom: boolean;
  disableAutoScroll: boolean;
  showAgentStream: boolean;
  
  // 设置方法
  setInputValue: (value: string) => void;
  setTextAreaDisabled: (disabled: boolean) => void;
  setSelectedImages: (images: string[] | ((prev: string[]) => string[])) => void;
  setDidClickCancel: (clicked: boolean) => void;
  setShowScrollToBottom: (show: boolean) => void;
  setIsAtBottom: (isBottom: boolean) => void;
  setDisableAutoScroll: (disable: boolean) => void;
  setShowAgentStream: (show: boolean) => void;
  toggleAgentStream: () => void;
  
  // 操作方法
  handleSendMessage: (text?: string, images?: string[]) => void;
  handleCancelStream: () => void;
  selectImages: () => void;
  
  // 计算属性
  getIsStreaming: () => boolean;
  getPlaceholderText: (task: ClineMessage | undefined, shouldDisableImages: boolean) => string;

  // 重置方法
  resetMessageState: () => void;
  resetAllState: () => void;

  // 消息处理
  handleMessage: (message: ExtensionMessage, textAreaRef?: React.RefObject<HTMLTextAreaElement>) => void;
  init: () => () => void;
}

export const useChatViewStore = create<IChatViewStore>((set, get) => ({
	// 初始状态
	inputValue: '',
	textAreaDisabled: false,
	selectedImages: [],
	clineAsk: undefined,
	enableButtons: false,
	secondaryButtonText: undefined,
	didClickCancel: false,
	showScrollToBottom: false,
	isAtBottom: false,
	disableAutoScroll: false,
	showAgentStream: false,
  
	// 设置方法
	setInputValue: (value) => set({ inputValue: value }),
	setTextAreaDisabled: (disabled) => set({ textAreaDisabled: disabled }),
	setSelectedImages: (images) => set((state) => ({ 
		selectedImages: typeof images === 'function' ? images(state.selectedImages) : images 
	})),
	setDidClickCancel: (clicked) => set({ didClickCancel: clicked }),
	setShowScrollToBottom: (show) => set({ showScrollToBottom: show }),
	setIsAtBottom: (isBottom) => set({ isAtBottom: isBottom }),
	setDisableAutoScroll: (disable) => set({ disableAutoScroll: disable }),
	setShowAgentStream: (show) => set({ showAgentStream: show }),
	toggleAgentStream: () => set((state) => ({ showAgentStream: !state.showAgentStream })),
  
	// 操作方法
	handleSendMessage: (text, images) => {
		if (!text && !images?.length){
			return;
		}
		text = text?.trim();
		const messages =  useClineMessageStore.getState().chatMessages;

		if (messages.length === 0) {
			messageBus.sendToBackground({ type: 'newTask', text, images });
		} else if (messages.length > 0) {
			messageBus.sendToBackground({ type: 'resumeTask', text, images });
		}
		// 重置消息相关状态
		get().resetMessageState();
	},
  
	handleCancelStream: () => {
		const isStreaming = get().getIsStreaming();

		if (isStreaming) {
			messageBus.sendToBackground({ type: 'cancelTask' });
			set({ 
				didClickCancel: true,
				textAreaDisabled: false 
			});
			return;
		}
    
		get().resetMessageState();
	},

	selectImages: () => {
		messageBus.sendToBackground({ type: 'selectImages' });
	},
  
	// 计算属性
	getIsStreaming: () => {
		const messages = useClineMessageStore.getState().chatMessages;
		const modifiedMessages = messages.slice(1);
		const lastMessage = modifiedMessages.at(-1);
		// 检查最后一条消息是否为流式传输中的部分响应
		if (lastMessage?.partial) return true;
    
		// 检查未完成的API请求
		const lastApiRequest = findLast(
			modifiedMessages,
			(msg) => msg.say === 'api_req_started'
		);
    
		if (lastApiRequest?.text) {
			try {
				const { tokensIn } = JSON.parse(lastApiRequest.text);
				// 还没token表示发送了请求，但还没返回内容
				return tokensIn === undefined;
			} catch (e) {
				console.error('Invalid API request JSON:', lastApiRequest.text);
			}
		}
    
		return false;
	},
  
	getPlaceholderText: (task, shouldDisableImages) => {
		const baseText = task ? 'Type a message...' : 'Type your task here...';
		const contextText = '(@ to add context';
		const imageText = shouldDisableImages ? '' : ', hold shift to drag in images';
		const helpText = imageText ? `\n${contextText}${imageText})` : `\n${contextText})`;
		return baseText + helpText;
	},
  
	// 重置方法
	resetMessageState: () => {
		set({
			inputValue: '',
			textAreaDisabled: true,
			selectedImages: [],
			disableAutoScroll: false
		});
	},
  
	resetAllState: () => {
		set({
			inputValue: '',
			textAreaDisabled: false,
			selectedImages: [],
			didClickCancel: false,
			showScrollToBottom: false,
			isAtBottom: false,
			disableAutoScroll: false
		});
	},

	// 消息处理
	handleMessage: (message) => {
		const {
			handleSendMessage,
			handleCancelStream,
			setSelectedImages
		} = get();
    
		switch (message.type) {
			case 'selectedImages':
				const newImages = message.images ?? [];
				if (newImages.length > 0) {
					setSelectedImages((prevImages: string[]) =>
						[...prevImages, ...newImages].slice(0, 20) // 使用常量 MAX_IMAGES_PER_MESSAGE
					);
				}
				break;
			case 'invoke':
				switch (message.invoke!) {
					case 'sendMessage':
						handleSendMessage(message.text ?? '', message.images ?? []);
						break;
					case 'secondaryButtonClick':
						handleCancelStream();
						break;
				}
		}
	},

	// 初始化方法
	init: () => {
		// 消息处理函数
		const handleExtensionMessage = (message: ExtensionMessage) => {
			get().handleMessage(message);
		};
    
		// 使用消息总线订阅扩展消息
		messageBus.on(BACKGROUND_MESSAGE, handleExtensionMessage as BackGroundMessageHandler);
    
		// 返回清理函数
		return () => {
			messageBus.off(BACKGROUND_MESSAGE, handleExtensionMessage as BackGroundMessageHandler);
		};
	}
}));
