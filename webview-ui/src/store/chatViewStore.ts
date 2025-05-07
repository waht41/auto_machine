import { create } from 'zustand';
import { ClineAsk, ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';
import { findLast } from '@/shared/array';
import { vscode } from '@webview-ui/utils/vscode';
import { useClineMessageStore } from './clineMessageStore';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from './const';
import { BackGroundMessageHandler } from './type';
import { ReplyContent } from '@webview-ui/components/chat/type';

// 定义聊天视图存储的状态类型
interface IChatViewStore {
  // 输入和交互状态
  inputValue: string;
  textAreaDisabled: boolean;
  selectedImages: string[];
  clineAsk: ClineAsk | undefined;
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
  setClineAsk: (ask: ClineAsk | undefined) => void;
  setDidClickCancel: (clicked: boolean) => void;
  setShowScrollToBottom: (show: boolean) => void;
  setIsAtBottom: (isBottom: boolean) => void;
  setDisableAutoScroll: (disable: boolean) => void;
  setShowAgentStream: (show: boolean) => void;
  toggleAgentStream: () => void;
  
  // 操作方法
  handleSendMessage: (text?: string, images?: string[]) => void;
  clearTask: () => void;
  handleCancelStream: () => void;
  selectImages: () => void;
  
  // 计算属性
  getIsStreaming: () => boolean;
  getPlaceholderText: (task: ClineMessage | undefined, shouldDisableImages: boolean) => string;
  getShowedMessage: (clineMessages: ClineMessage[]) => (ClineMessage | ClineMessage[])[];
  
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
	expandedRows: {},
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
	setClineAsk: (ask) => set({ clineAsk: ask }),
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
		const getChatMessages = useClineMessageStore.getState().getChatMessages;
		const messages = getChatMessages();
		const clineAsk = get().clineAsk;
      
		if (messages.length === 0) {
			vscode.postMessage({ type: 'newTask', text, images });
		} else if (messages.length > 0) {
			vscode.postMessage({ type: 'resumeTask', text, images });
		} else if (clineAsk) {
			switch (clineAsk) {
				case 'text':
				case 'tool':
					vscode.postMessage({
						type: 'askResponse',
						askResponse: 'messageResponse',
						text,
						images,
					});
					break;
			}
		}
		// 重置消息相关状态
		get().resetMessageState();
	},
  
	clearTask: () => {
		const clear = useClineMessageStore.getState().clearClineMessages;
		clear();
		vscode.postMessage({ type: 'clearTask' });
	},
  
	handleCancelStream: () => {
		const isStreaming = get().getIsStreaming();

		if (isStreaming) {
			vscode.postMessage({ type: 'cancelTask' });
			set({ 
				didClickCancel: true,
				textAreaDisabled: false 
			});
			return;
		}
    
		get().resetMessageState();
	},

	selectImages: () => {
		vscode.postMessage({ type: 'selectImages' });
	},
  
	// 计算属性
	getIsStreaming: () => {
		const getChatMessages = useClineMessageStore.getState().getChatMessages;
		const messages = getChatMessages();
		const modifiedMessages = messages.slice(1);
		const clineAsk = get().clineAsk;
    
		const lastMessage = modifiedMessages.at(-1);
		const lastMessageIsAsk = !!lastMessage?.ask;
    
		// 判断工具是否处于主动提问状态
		const isToolActive = lastMessageIsAsk &&
      clineAsk !== undefined; 
		if (isToolActive) return false;
    
		// 检查最后一条消息是否为流式传输中的部分响应
		if (lastMessage?.partial) return true;
    
		// 检查未完成的API请求
		const lastApiRequest = findLast(
			modifiedMessages,
			(msg) => msg.say === 'api_req_started'
		);
    
		if (lastApiRequest?.text) {
			try {
				const { cost } = JSON.parse(lastApiRequest.text);
				// 当cost未定义时表示请求尚未完成
				return cost === undefined;
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
  
	getShowedMessage: (clineMessages) => {
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
    
		for (const message of clineMessages) {
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
	},
  
	// 重置方法
	resetMessageState: () => {
		set({
			inputValue: '',
			textAreaDisabled: true,
			selectedImages: [],
			clineAsk: undefined,
			disableAutoScroll: false
		});
	},
  
	resetAllState: () => {
		set({
			inputValue: '',
			textAreaDisabled: false,
			selectedImages: [],
			clineAsk: undefined,
			didClickCancel: false,
			showScrollToBottom: false,
			isAtBottom: false,
			disableAutoScroll: false
		});
	},

	// 消息处理
	handleMessage: (message, textAreaRef) => {
		const {
			textAreaDisabled,
			handleSendMessage,
			handleCancelStream,
			setSelectedImages
		} = get();
    
		switch (message.type) {
			case 'action':
				switch (message.action!) {
					case 'didBecomeVisible':
						if (!textAreaDisabled && textAreaRef?.current) {
							textAreaRef.current.focus();
						}
						break;
				}
				break;
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
