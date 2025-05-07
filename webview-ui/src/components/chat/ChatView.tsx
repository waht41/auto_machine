import debounce from 'debounce';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMount } from 'react-use';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import styled from 'styled-components';
import { useExtensionState } from '../../context/ExtensionStateContext';
import ChatRow from './ChatRow/ChatRow';
import ChatTextArea from './ChatTextArea';
import { normalizeApiConfiguration } from '@webview-ui/components/settings/ApiOptions/utils';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import NewerExample from '@webview-ui/components/chat/NewerExample';
import { ReplyContent } from '@webview-ui/components/chat/type';
import { colors } from '@webview-ui/components/common/styles';

export const MAX_IMAGES_PER_MESSAGE = 20; // Anthropic limits to 20 images

const ChatViewContainer = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: ${colors.backgroundMain};
`;

const ScrollContainer = styled.div`
	flex: 1 1 auto;
	width: 95%;
	margin: 0 auto;
	display: flex;
	min-height: 0;
	position: relative; /* 添加相对定位，作为绝对定位按钮的参考点 */
`;

const VirtuosoContainer = styled(Virtuoso<ReplyContent, unknown>)`
	flex: 1 1 auto;
	height: 100%;
	overflow-y: scroll; /* always show scrollbar */
`;

const FooterContainer = styled.div`
	height: 5px;
`;

const ScrollToBottomContainer = styled.div`
	position: absolute;
	bottom: 20px;
	right: 20px;
	z-index: 100;
`;

const ScrollToBottomButton = styled.div`
	border-radius: 50%;
	width: 36px;
	height: 36px;
	overflow: hidden;
	cursor: pointer;
	display: flex;
	justify-content: center;
	align-items: center;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

	&:hover {
		transform: translateY(-2px);
		transition: transform 0.2s ease;
	}

	&:active {
		transform: translateY(0);
	}
`;

const EmptyStateContainer = styled.div`
	display: flex;
	align-items: stretch;
	justify-content: center;
	flex-direction: column;
	width: 100%;
	height: 80%;
`;

const WelcomeText = styled.div`
	font-size: 40px;
	font-weight: 500;
	font-family: 'Roboto';
	margin: 0 auto;
`;

const ChatTextAreaWrapper = styled.div`
	margin-top: 24px;
	margin-bottom: 24px;
`;

const ChatView = () => {
	const {
		apiConfiguration,
		toolCategories,
		allowedTools
	} = useExtensionState();
	const getChatMessages = useClineMessageStore(state => state.getChatMessages);
	const messages = getChatMessages();

	// 使用 chatViewStore 中的状态和方法
	const {
		inputValue,
		setInputValue,
		textAreaDisabled,
		setTextAreaDisabled,
		selectedImages,
		setSelectedImages,
		clineAsk,
		setClineAsk,
		showScrollToBottom,
		setShowScrollToBottom,
		isAtBottom,
		setIsAtBottom,
		setDisableAutoScroll,
		handleSendMessage,
		handleCancelStream,
		selectImages,
		getIsStreaming,
		getPlaceholderText,
		resetAllState,
		handleMessage,
		init,
		getShowedMessage
	} = useChatViewStore();

	const task = useMemo(() => messages.at(0), [messages]); // leaving this less safe version here since if the first message is not a task, then the extension is in a bad state and needs to be debugged (see Cline.abort)
	const modifiedMessages = useMemo(() => messages.slice(1), [messages]);
	// 使用 getShowedMessage 函数处理消息
	const showedMessages = useMemo(() => getShowedMessage(modifiedMessages), [modifiedMessages, getShowedMessage]);

	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const virtuosoRef = useRef<VirtuosoHandle>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const disableAutoScrollRef = useRef(false);

	// UI layout depends on the last 2 messages
	// (since it relies on the content of these messages, we are deep comparing. i.e. the button state after hitting button sets enableButtons to false, and this effect otherwise would have to true again even if messages didn't change
	const lastMessage = useMemo(() => messages.at(-1), [messages]);
	const secondLastMessage = useMemo(() => messages.at(-2), [messages]);
	const isStreaming = useMemo(() => getIsStreaming(), [modifiedMessages, clineAsk]);

	// 初始化消息监听
	useEffect(() => {
		// 初始化消息监听
		const cleanup = init();
		
		// 组件卸载时清理
		return () => {
			cleanup();
		};
	}, [init]);
	
	// 提供 textAreaRef 给 handleMessage
	useEffect(() => {
		// 创建一个函数，将消息和 textAreaRef 传递给 handleMessage
		const handleExtensionMessage = (event: MessageEvent) => {
			handleMessage(event.data, textAreaRef);
		};
		
		// 添加事件监听器
		window.addEventListener('message', handleExtensionMessage);
		
		// 清理函数
		return () => {
			window.removeEventListener('message', handleExtensionMessage);
		};
	}, [handleMessage]);

	useEffect(() => {
		// if last message is an ask, show user ask UI
		// if user finished a task, then start a new task with a new conversation history since in this moment that the extension is waiting for user response, the user could close the extension and the conversation history would be lost.
		// basically as long as a task is active, the conversation history will be persisted
		if (lastMessage) {
			const isPartial = lastMessage.partial === true;
			switch (lastMessage.type) {
				case 'ask':
					switch (lastMessage.ask) {
						case 'text':
							setTextAreaDisabled(isPartial);
							setClineAsk('text');
							break;
						case 'tool':
							setTextAreaDisabled(isPartial);
							setClineAsk('tool');
							break;
					}
					break;
				case 'say':
					setTextAreaDisabled(isPartial || isStreaming);
					break;
			}
		}
	}, [lastMessage, secondLastMessage, setTextAreaDisabled, setClineAsk]);

	useEffect(() => {
		if (messages.length === 0) {
			resetAllState();
		}
	}, [messages.length, resetAllState]);

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration);
	}, [apiConfiguration]);

	const shouldDisableImages =
		!selectedModelInfo.supportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE;

	useMount(() => {
		// NOTE: the vscode window needs to be focused for this to work
		textAreaRef.current?.focus();
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!textAreaDisabled) {
				textAreaRef.current?.focus();
			}
		}, 50);
		return () => {
			clearTimeout(timer);
		};
	}, [textAreaDisabled]);

	// scrolling

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(
				() => {
					virtuosoRef.current?.scrollTo({
						top: Number.MAX_SAFE_INTEGER,
						behavior: 'smooth',
					});
				},
				10,
				{ immediate: true },
			),
		[],
	);

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollTo({
			top: Number.MAX_SAFE_INTEGER,
			behavior: 'auto', // instant causes crash
		});
	}, []);

	// 处理行高度变化
	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (!disableAutoScrollRef.current) {
				if (isTaller) {
					scrollToBottomSmooth();
				} else {
					setTimeout(() => {
						scrollToBottomAuto();
					}, 0);
				}
			}
		},
		[scrollToBottomSmooth, scrollToBottomAuto],
	);

	useEffect(() => {
		if (!disableAutoScrollRef.current) {
			setTimeout(() => {
				scrollToBottomSmooth();
			}, 50);
			// return () => clearTimeout(timer) // dont cleanup since if visibleMessages.length changes it cancels.
		}
	}, [showedMessages.length, scrollToBottomSmooth]);

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent;
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				// 用户向上滚动，只有当状态需要变化时才更新
				if (!disableAutoScrollRef.current) {
					disableAutoScrollRef.current = true;
					setDisableAutoScroll(true);
				}
			}
		}
	}, [setDisableAutoScroll]);

	// 使用节流函数包装滚动处理函数，减少事件处理频率
	const throttledHandleWheel = useMemo(() => {
		return debounce(handleWheel, 100, { immediate: true });
	}, [handleWheel]);

	useEffect(() => {
		window.addEventListener('wheel', throttledHandleWheel, { passive: true });
		
		return () => {
			window.removeEventListener('wheel', throttledHandleWheel);
			// 清理节流函数
			throttledHandleWheel.clear();
		};
	}, [throttledHandleWheel]);

	const placeholderText = useMemo(() => {
		return getPlaceholderText(task, shouldDisableImages);
	}, [task, shouldDisableImages, getPlaceholderText]);

	const itemContent = useCallback(
		(index: number, message: ReplyContent) => {
			const ts = Array.isArray(message)? message[0].ts : message.ts;
			return (
				<ChatRow
					key={ts}
					message={message}
					isLast={index === showedMessages.length - 1}
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
				/>
			);
		},
		[
			handleRowHeightChange,
			isStreaming,
		],
	);

	// 创建通用的 ChatTextArea 属性对象
	const createChatTextAreaProps = useCallback(() => ({
		inputValue,
		setInputValue,
		textAreaDisabled,
		placeholderText,
		selectedImages,
		setSelectedImages,
		onSend: () => handleSendMessage(inputValue, selectedImages),
		onCancel: handleCancelStream,
		onSelectImages: selectImages,
		shouldDisableImages,
		onHeightChange: () => {
			if (isAtBottom) {
				scrollToBottomAuto();
			}
		},
		allowedTools,
		toolCategories
	}), [
		inputValue, 
		setInputValue, 
		textAreaDisabled, 
		placeholderText, 
		selectedImages, 
		setSelectedImages, 
		handleSendMessage,
		selectImages,
		shouldDisableImages, 
		isAtBottom, 
		scrollToBottomAuto, 
		allowedTools, 
		toolCategories
	]);

	// 获取通用属性
	const chatTextAreaProps = useMemo(() => createChatTextAreaProps(), [createChatTextAreaProps]);

	return (
		<ChatViewContainer>
			{task && (
				<>
					<ScrollContainer ref={scrollContainerRef}>
						<VirtuosoContainer
							ref={virtuosoRef}
							key={task?.ts} // trick to make sure virtuoso re-renders when task changes, and we use initialTopMostItemIndex to start at the bottom
							className="scrollable"
							components={{
								Footer: () => <FooterContainer />, // Add empty padding at the bottom
							}}
							// increasing top by 3_000 to prevent jumping around when user collapses a row
							increaseViewportBy={{ top: 3_000, bottom: Number.MAX_SAFE_INTEGER }} // hack to make sure the last message is always rendered to get truly perfect scroll to bottom animation when new messages are added (Number.MAX_SAFE_INTEGER is safe for arithmetic operations, which is all virtuoso uses this value for in src/sizeRangeSystem.ts)
							data={showedMessages} // messages is the raw format returned by extension, modifiedMessages is the manipulated structure that combines certain messages of related type, and visibleMessages is the filtered structure that removes messages that should not be rendered
							itemContent={itemContent}
							atBottomStateChange={(atBottom) => {
								// 避免频繁更新状态，只在状态变化时更新
								if (isAtBottom !== atBottom) {
									setIsAtBottom(atBottom);
									if (atBottom) {
										disableAutoScrollRef.current = false;
										setDisableAutoScroll(false);
									}
									setShowScrollToBottom(disableAutoScrollRef.current && !atBottom);
								}
							}}
							atBottomThreshold={10} // anything lower causes issues with followOutput
							initialTopMostItemIndex={showedMessages.length - 1}
							// 添加优化选项，减少不必要的渲染
							overscan={{ main: 5, reverse: 5 }}
							// 添加缓存优化
							computeItemKey={(index) => {
								const message = showedMessages[index];
								return Array.isArray(message) ? `group-${message[0].ts}` : `message-${message.ts}`;
							}}
						/>
						{showScrollToBottom ? (
							<ScrollToBottomContainer>
								<ScrollToBottomButton
									onClick={() => {
										scrollToBottomSmooth();
										disableAutoScrollRef.current = false;
										setDisableAutoScroll(false);
									}}>
									<span className="codicon codicon-chevron-down" style={{ fontSize: '20px' }}></span>
								</ScrollToBottomButton>
							</ScrollToBottomContainer>
						) : null}
					</ScrollContainer>
					<ChatTextAreaWrapper>
						<ChatTextArea
							ref={textAreaRef}
							{...chatTextAreaProps}
						/>
					</ChatTextAreaWrapper>
				</>
			)}

			{!task && <EmptyStateContainer>
				<WelcomeText>what can I do for you?</WelcomeText>

				<ChatTextAreaWrapper>
					<ChatTextArea
						ref={textAreaRef}
						{...chatTextAreaProps}
					/>
				</ChatTextAreaWrapper>
				<NewerExample/>
			</EmptyStateContainer>}
		</ChatViewContainer>

	);
};

export default ChatView;
