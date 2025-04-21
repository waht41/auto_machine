import { create } from 'zustand';
import { ClineAsk, ClineMessage, ExtensionMessage } from '@/shared/ExtensionMessage';
import { findLast } from '@/shared/array';
import { vscode } from '@webview-ui/utils/vscode';
import { useClineMessageStore } from './clineMessageStore';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from './const';
import { BackGroundMessageHandler } from './type';
import { ShowedMessage } from '@webview-ui/components/chat/type';

// 定义聊天视图存储的状态类型
interface IChatViewStore {
  // 输入和交互状态
  inputValue: string;
  textAreaDisabled: boolean;
  selectedImages: string[];
  clineAsk: ClineAsk | undefined;
  enableButtons: boolean;
  secondaryButtonText: string | undefined;
  didClickCancel: boolean;
  
  // 滚动和展示状态
  expandedRows: Record<number, boolean>;
  showScrollToBottom: boolean;
  isAtBottom: boolean;
  disableAutoScroll: boolean;
  showAgentStream: boolean;
  
  // 设置方法
  setInputValue: (value: string) => void;
  setTextAreaDisabled: (disabled: boolean) => void;
  setSelectedImages: (images: string[] | ((prev: string[]) => string[])) => void;
  setClineAsk: (ask: ClineAsk | undefined) => void;
  setEnableButtons: (enable: boolean) => void;
  setSecondaryButtonText: (text: string | undefined) => void;
  setDidClickCancel: (clicked: boolean) => void;
  setExpandedRows: (rows: Record<number, boolean> | ((prev: Record<number, boolean>) => Record<number, boolean>)) => void;
  setShowScrollToBottom: (show: boolean) => void;
  setIsAtBottom: (isBottom: boolean) => void;
  setDisableAutoScroll: (disable: boolean) => void;
  setShowAgentStream: (show: boolean) => void;
  toggleAgentStream: () => void;
  
  // 操作方法
  handleSendMessage: (text: string, images: string[]) => void;
  clearTask: () => void;
  handlePrimaryButtonClick: () => void;
  handleSecondaryButtonClick: () => void;
  toggleRowExpansion: (ts: number) => void;
  selectImages: () => void;
  
  // 计算属性
  isStreaming: () => boolean;
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
	setEnableButtons: (enable) => set({ enableButtons: enable }),
	setSecondaryButtonText: (text) => set({ secondaryButtonText: text }),
	setDidClickCancel: (clicked) => set({ didClickCancel: clicked }),
	setExpandedRows: (rows) => set((state) => ({ 
		expandedRows: typeof rows === 'function' ? rows(state.expandedRows) : rows 
	})),
	setShowScrollToBottom: (show) => set({ showScrollToBottom: show }),
	setIsAtBottom: (isBottom) => set({ isAtBottom: isBottom }),
	setDisableAutoScroll: (disable) => set({ disableAutoScroll: disable }),
	setShowAgentStream: (show) => set({ showAgentStream: show }),
	toggleAgentStream: () => set((state) => ({ showAgentStream: !state.showAgentStream })),
  
	// 操作方法
	handleSendMessage: (text, images) => {
		text = text.trim();
		if (text || images.length > 0) {
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
		}
	},
  
	clearTask: () => {
		const clear = useClineMessageStore.getState().clearClineMessages;
		clear();
		vscode.postMessage({ type: 'clearTask' });
	},
  
	handlePrimaryButtonClick: () => {
		const clineAsk = get().clineAsk;
    
		switch (clineAsk) {
			case 'tool':
				vscode.postMessage({ type: 'askResponse', askResponse: 'yesButtonClicked' });
				break;
		}
    
		get().resetMessageState();
	},
  
	handleSecondaryButtonClick: () => {
		const isStreaming = get().isStreaming();
		const clineAsk = get().clineAsk;
    
		if (isStreaming) {
			vscode.postMessage({ type: 'cancelTask' });
			set({ 
				didClickCancel: true,
				textAreaDisabled: false 
			});
			return;
		}
    
		switch (clineAsk) {
			case 'tool':
				vscode.postMessage({ type: 'askResponse', askResponse: 'noButtonClicked' });
				break;
		}
    
		get().resetMessageState();
	},
  
	toggleRowExpansion: (ts) => {
		const expandedRows = get().expandedRows;
		const isCollapsing = expandedRows[ts] || false;
      
		// 更新展开状态
		set((state) => ({
			expandedRows: {
				...state.expandedRows,
				[ts]: !state.expandedRows[ts],
			}
		}));
    
		// 当用户展开行时禁用自动滚动
		if (!isCollapsing) {
			set({ disableAutoScroll: true });
		}
    
		// 根据展开/折叠状态和位置处理滚动
		// 注意：这里不包含滚动逻辑的实现，因为它需要直接操作 virtuosoRef
		// 在组件中使用此 store 时，需要添加相应的滚动处理逻辑
	},
  
	selectImages: () => {
		vscode.postMessage({ type: 'selectImages' });
	},
  
	// 计算属性
	isStreaming: () => {
		const getChatMessages = useClineMessageStore.getState().getChatMessages;
		const messages = getChatMessages();
		const modifiedMessages = messages.slice(1);
		const clineAsk = get().clineAsk;
		const enableButtons = get().enableButtons;
    
		const lastMessage = modifiedMessages.at(-1);
		const lastMessageIsAsk = !!lastMessage?.ask;
    
		// 判断工具是否处于主动提问状态
		const isToolActive = lastMessageIsAsk &&
      clineAsk !== undefined &&
      enableButtons;
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
		const showedMessages: ShowedMessage[] = [];
		let currentGroup: ClineMessage[] = [];
    
		// 辅助函数：添加当前消息组到结果中
		const addCurrentGroup = () => {
			if (currentGroup.length > 0) {
				// 如果当前组只有一个消息，直接添加该消息
				if (currentGroup.length === 1) {
					showedMessages.push(currentGroup[0]);
				} 
				// 如果当组有两条消息且第一条是 api_req_started 时，分别添加两条消息
				else if (currentGroup.length === 2 && currentGroup[0].say === 'api_req_started') {
					showedMessages.push(currentGroup[0]);
					showedMessages.push(currentGroup[1]);
				} 
				// 其他情况，添加为数组
				else {
					showedMessages.push(currentGroup);
				}
				currentGroup = [];
			}
		};
    
		for (const message of clineMessages) {
			if (message.say === 'text' || message.say === 'tool' || message.say === 'api_req_started' || message.ask === 'tool') {
				currentGroup.push(message);
			} else {
				addCurrentGroup();
				showedMessages.push(message);
			}
		}
    
		addCurrentGroup();

		console.log('[waht]','shoedmessages',showedMessages);
    
		return showedMessages;
	},
  
	// 重置方法
	resetMessageState: () => {
		set({
			inputValue: '',
			textAreaDisabled: true,
			selectedImages: [],
			clineAsk: undefined,
			enableButtons: false,
			disableAutoScroll: false
		});
	},
  
	resetAllState: () => {
		set({
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
			disableAutoScroll: false
		});
	},
  
	// 消息处理
	handleMessage: (message, textAreaRef) => {
		const {
			textAreaDisabled,
			enableButtons,
			handleSendMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
			setSelectedImages
		} = get();
    
		switch (message.type) {
			case 'action':
				switch (message.action!) {
					case 'didBecomeVisible':
						if (!textAreaDisabled && !enableButtons && textAreaRef?.current) {
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
					case 'primaryButtonClick':
						handlePrimaryButtonClick();
						break;
					case 'secondaryButtonClick':
						handleSecondaryButtonClick();
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
