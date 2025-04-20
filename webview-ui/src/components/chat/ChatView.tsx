import debounce from 'debounce';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMount } from 'react-use';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import styled from 'styled-components';
import { useExtensionState } from '../../context/ExtensionStateContext';
import ChatRow from './ChatRow/ChatRow';
import ChatTextArea from './ChatTextArea';
import { normalizeApiConfiguration } from '@webview-ui/components/settings/ApiOptions/utils';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';
import NewerExample from '@webview-ui/components/chat/NewerExample';
import { ShowedMessage } from '@webview-ui/components/chat/type';

export const MAX_IMAGES_PER_MESSAGE = 20; // Anthropic limits to 20 images

const ChatViewContainer = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
`;

const ScrollContainer = styled.div`
	flex: 1 1 auto;
	display: flex;
	min-height: 0;
	position: relative; /* 添加相对定位，作为绝对定位按钮的参考点 */
`;

const VirtuosoContainer = styled(Virtuoso<ShowedMessage, unknown>)`
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

const ButtonsContainer = styled.div<{ opacity: number }>`
	opacity: ${props => props.opacity};
	display: flex;
	padding: ${props => props.opacity > 0 ? '10px 15px 0px 15px' : '0px 15px 0px 15px'};
`;

const SecondaryButton = styled(VSCodeButton)<{ isStreaming: boolean }>`
	flex: ${props => props.isStreaming ? 2 : 1};
	margin-left: ${props => props.isStreaming ? 0 : '6px'};
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
		enableButtons,
		setEnableButtons,
		secondaryButtonText,
		didClickCancel,
		expandedRows,
		setExpandedRows,
		showScrollToBottom,
		setShowScrollToBottom,
		isAtBottom,
		setIsAtBottom,
		setDisableAutoScroll,
		handleSendMessage,
		handleSecondaryButtonClick,
		toggleRowExpansion,
		selectImages,
		isStreaming: getIsStreaming,
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
	const isStreaming = useMemo(() => getIsStreaming(), [modifiedMessages, clineAsk, enableButtons]);

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
			switch (lastMessage.type) {
				case 'ask':
					const isPartial = lastMessage.partial === true;
					switch (lastMessage.ask) {
						case 'text':
							setTextAreaDisabled(isPartial);
							setClineAsk('text');
							setEnableButtons(isPartial);
							break;
						case 'tool':
							setTextAreaDisabled(isPartial);
							setClineAsk('tool');
							break;
					}
					break;
				case 'say':
					break;
			}
		}
	}, [lastMessage, secondLastMessage, setTextAreaDisabled, setClineAsk, setEnableButtons]);

	useEffect(() => {
		if (messages.length === 0) {
			resetAllState();
		}
	}, [messages.length, resetAllState]);

	useEffect(() => {
		setExpandedRows({});
	}, [task?.ts, setExpandedRows]);

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
			if (!textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus();
			}
		}, 50);
		return () => {
			clearTimeout(timer);
		};
	}, [textAreaDisabled, enableButtons]);

	const visibleMessages = useMemo(() => {
		return showedMessages.filter((message) => {
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
	}, [showedMessages]);

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

	// 处理行展开/折叠
	const handleToggleRowExpansion = useCallback(
		(ts: number) => {
			const isCollapsing = expandedRows[ts] || false;
			const lastVisibleMessage = visibleMessages.at(-1);
			
			// 处理最后一条消息是数组的情况
			const isLast = Array.isArray(lastVisibleMessage) 
				? lastVisibleMessage.some(msg => msg.ts === ts)
				: lastVisibleMessage?.ts === ts;
				
			const secondVisibleMessage = visibleMessages.at(-2);
			const isSecondToLast = Array.isArray(secondVisibleMessage)
				? secondVisibleMessage.some(msg => msg.ts === ts)
				: secondVisibleMessage?.ts === ts;

			// 处理最后一条消息是 api_req_started 且未展开的情况
			let isLastCollapsedApiReq = false;
			if (Array.isArray(lastVisibleMessage)) {
				isLastCollapsedApiReq = lastVisibleMessage.some(msg => 
					msg.ts === ts && msg.say === 'api_req_started' && !expandedRows[msg.ts]
				);
			} else {
				isLastCollapsedApiReq = isLast &&
					lastVisibleMessage?.say === 'api_req_started' &&
					!expandedRows[lastVisibleMessage.ts];
			}

			toggleRowExpansion(ts);

			// 根据展开/折叠状态和位置处理滚动
			if (isCollapsing && isAtBottom) {
				const timer = setTimeout(() => {
					scrollToBottomAuto();
				}, 0);
				return () => clearTimeout(timer);
			} else if (isLast || isSecondToLast) {
				if (isCollapsing) {
					if (isSecondToLast && !isLastCollapsedApiReq) {
						return;
					}
					const timer = setTimeout(() => {
						scrollToBottomAuto();
					}, 0);
					return () => clearTimeout(timer);
				} else {
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: visibleMessages.length - (isLast ? 1 : 2),
							align: 'start',
						});
					}, 0);
					return () => clearTimeout(timer);
				}
			}
		},
		[visibleMessages, expandedRows, scrollToBottomAuto, isAtBottom, toggleRowExpansion],
	);

	useEffect(() => {
		if (!disableAutoScrollRef.current) {
			setTimeout(() => {
				scrollToBottomSmooth();
			}, 50);
			// return () => clearTimeout(timer) // dont cleanup since if visibleMessages.length changes it cancels.
		}
	}, [visibleMessages.length, scrollToBottomSmooth]);

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent;
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				// user scrolled up
				disableAutoScrollRef.current = true;
				setDisableAutoScroll(true);
			}
		}
	}, [setDisableAutoScroll]);
	
	// 使用原生事件监听，而不是 useEvent
	useEffect(() => {
		window.addEventListener('wheel', handleWheel, { passive: true });
		
		return () => {
			window.removeEventListener('wheel', handleWheel);
		};
	}, [handleWheel]);

	const placeholderText = useMemo(() => {
		return getPlaceholderText(task, shouldDisableImages);
	}, [task, shouldDisableImages, getPlaceholderText]);

	const itemContent = useCallback(
		(index: number, message: ShowedMessage) => {
			const ts = Array.isArray(message)? message[0].ts : message.ts;
			return (
				<ChatRow
					key={ts}
					message={message}
					isExpanded={expandedRows[ts] || false}
					onToggleExpand={() => handleToggleRowExpansion(ts)}
					isLast={index === visibleMessages.length - 1}
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
				/>
			);
		},
		[
			expandedRows,
			visibleMessages.length,
			handleRowHeightChange,
			isStreaming,
			handleToggleRowExpansion,
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
							data={visibleMessages} // messages is the raw format returned by extension, modifiedMessages is the manipulated structure that combines certain messages of related type, and visibleMessages is the filtered structure that removes messages that should not be rendered
							itemContent={itemContent}
							atBottomStateChange={(atBottom) => {
								setIsAtBottom(atBottom);
								if (atBottom) {
									disableAutoScrollRef.current = false;
									setDisableAutoScroll(false);
								}
								setShowScrollToBottom(disableAutoScrollRef.current && !atBottom);
							}}
							atBottomThreshold={10} // anything lower causes issues with followOutput
							initialTopMostItemIndex={visibleMessages.length - 1}
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
					{!showScrollToBottom && (
						<ButtonsContainer
							opacity={
								secondaryButtonText || isStreaming
									? enableButtons || (isStreaming && !didClickCancel)
										? 1
										: 0.5
									: 0
							}>
							{(secondaryButtonText || isStreaming) && (
								<SecondaryButton
									appearance="secondary"
									disabled={!enableButtons && !(isStreaming && !didClickCancel)}
									isStreaming={isStreaming}
									onClick={handleSecondaryButtonClick}>
									{isStreaming ? 'Cancel' : secondaryButtonText}
								</SecondaryButton>
							)}
						</ButtonsContainer>
					)}
					<ChatTextArea
						ref={textAreaRef}
						{...chatTextAreaProps}
					/>
				</>
			)}

			{!task && <EmptyStateContainer>
				<WelcomeText>what can I do for you?</WelcomeText>

				<ChatTextArea
					ref={textAreaRef}
					{...chatTextAreaProps}
				/>
				<NewerExample/>
			</EmptyStateContainer>}
		</ChatViewContainer>

	);
};

export default ChatView;
