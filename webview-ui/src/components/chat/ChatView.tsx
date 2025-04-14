import debounce from 'debounce';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent, useMount } from 'react-use';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import styled from 'styled-components';
import {
	ClineAsk,
	ClineMessage,
	ExtensionMessage,
} from '@/shared/ExtensionMessage';
import { findLast } from '@/shared/array';
import { getApiMetrics } from '@/shared/getApiMetrics';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { vscode } from '../../utils/vscode';
import ChatRow from './ChatRow/ChatRow';
import ChatTextArea from './ChatTextArea';
import TaskHeader from './TaskHeader';
import AutoApproveMenu from './AutoApproveMenu';
import { normalizeApiConfiguration } from '@webview-ui/components/settings/ApiOptions/utils';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import ChatHistory from '@webview-ui/components/chat/ChatHistory';
import { useClineMessageStore } from '@webview-ui/store/clineMessageStore';
import TabNavigation from '@webview-ui/components/navigation/TabNavigation';

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

const VirtuosoContainer = styled(Virtuoso<ClineMessage, unknown>)`
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

const ChatView = () => {
	const {
		apiConfiguration,
		toolCategories,
		allowedTools
	} = useExtensionState();
	const getChatMessages = useClineMessageStore(state => state.getChatMessages);
	const messages = getChatMessages();
	const clear = useClineMessageStore((state) => state.clearClineMessages);

	const task = useMemo(() => messages.at(0), [messages]); // leaving this less safe version here since if the first message is not a task, then the extension is in a bad state and needs to be debugged (see Cline.abort)
	const modifiedMessages = useMemo(() => messages.slice(1), [messages]);
	// has to be after api_req_finished are all reduced into api_req_started messages
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages]);

	const [inputValue, setInputValue] = useState('');
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const [textAreaDisabled, setTextAreaDisabled] = useState(false);
	const [selectedImages, setSelectedImages] = useState<string[]>([]);

	// we need to hold on to the ask because useEffect > lastMessage will always let us know when an ask comes in and handle it, but by the time handleMessage is called, the last message might not be the ask anymore (it could be a say that followed)
	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined);
	const [enableButtons, setEnableButtons] = useState<boolean>(false);
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined);
	const [didClickCancel, setDidClickCancel] = useState(false);
	const virtuosoRef = useRef<VirtuosoHandle>(null);
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const disableAutoScrollRef = useRef(false);
	const [showScrollToBottom, setShowScrollToBottom] = useState(false);
	const [isAtBottom, setIsAtBottom] = useState(false);

	// UI layout depends on the last 2 messages
	// (since it relies on the content of these messages, we are deep comparing. i.e. the button state after hitting button sets enableButtons to false, and this effect otherwise would have to true again even if messages didn't change
	const lastMessage = useMemo(() => messages.at(-1), [messages]);
	const secondLastMessage = useMemo(() => messages.at(-2), [messages]);

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
	}, [lastMessage, secondLastMessage]);

	useEffect(() => {
		if (messages.length === 0) {
			setTextAreaDisabled(false);
			setClineAsk(undefined);
			setEnableButtons(false);
			setSecondaryButtonText(undefined);
		}
	}, [messages.length]);

	useEffect(() => {
		setExpandedRows({});
	}, [task?.ts]);

	const isStreaming = useMemo(() => {
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
	}, [modifiedMessages, clineAsk, enableButtons]);

	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim();
			if (text || images.length > 0) {
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
						// there is no other case that a textfield should be enabled
					}
				}
				// Only reset message-specific state, preserving mode
				setInputValue('');
				setTextAreaDisabled(true);
				setSelectedImages([]);
				setClineAsk(undefined);
				setEnableButtons(false);
				// Do not reset mode here as it should persist
				// setPrimaryButtonText(undefined)
				// setSecondaryButtonText(undefined)
				disableAutoScrollRef.current = false;
			}
		},
		[messages.length, clineAsk],
	);

	const clearTask = useCallback(() => {
		clear();
		console.log('[waht]','cleartask', task);
		vscode.postMessage({ type: 'clearTask' });
	}, [task]);

	/*
	This logic depends on the useEffect[messages] above to set clineAsk, after which buttons are shown and we then send an askResponse to the extension.
	*/
	const handlePrimaryButtonClick = useCallback(() => {
		switch (clineAsk) {
			case 'tool':
				vscode.postMessage({ type: 'askResponse', askResponse: 'yesButtonClicked' });
				break;
		}
		setTextAreaDisabled(true);
		setClineAsk(undefined);
		setEnableButtons(false);
		disableAutoScrollRef.current = false;
	}, [clineAsk, clearTask]);

	const handleSecondaryButtonClick = useCallback(() => {
		if (isStreaming) {
			vscode.postMessage({ type: 'cancelTask' });
			setDidClickCancel(true);
			setTextAreaDisabled(false);
			return;
		}

		switch (clineAsk) {
			case 'tool':
				// responds to the API with a "This operation failed" and lets it try again
				vscode.postMessage({ type: 'askResponse', askResponse: 'noButtonClicked' });
				break;
		}
		setTextAreaDisabled(true);
		setClineAsk(undefined);
		setEnableButtons(false);
		disableAutoScrollRef.current = false;
	}, [clineAsk, clearTask, isStreaming]);

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration);
	}, [apiConfiguration]);

	const selectImages = useCallback(() => {
		vscode.postMessage({ type: 'selectImages' });
	}, []);

	const shouldDisableImages =
		!selectedModelInfo.supportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE;

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data;
			switch (message.type) {
				case 'action':
					switch (message.action!) {
						case 'didBecomeVisible':
							if (!textAreaDisabled && !enableButtons) {
								textAreaRef.current?.focus();
							}
							break;
					}
					break;
				case 'selectedImages':
					const newImages = message.images ?? [];
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE),
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
			// textAreaRef.current is not explicitly required here since react gaurantees that ref will be stable across re-renders, and we're not using its value but its reference.
		},
		[
			textAreaDisabled,
			enableButtons,
			handleSendMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
		],
	);

	useEvent('message', handleMessage);

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
		return modifiedMessages.filter((message) => {
			switch (message.say) {
				case 'text':
					// Sometimes cline returns an empty text message, we don't want to render these. (We also use a say text for user messages, so in case they just sent images we still render that)
					if ((message.text ?? '') === '' && (message.images?.length ?? 0) === 0) {
						return false;
					}
					break;
			}
			return true;
		});
	}, [modifiedMessages]);

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

	// scroll when user toggles certain rows
	const toggleRowExpansion = useCallback(
		(ts: number) => {
			const isCollapsing = expandedRows[ts] ?? false;
			const lastVisibleMessage = visibleMessages.at(-1);
			const isLast = Array.isArray(lastVisibleMessage) ? lastVisibleMessage[0].ts === ts : lastVisibleMessage?.ts === ts;
			const secondVisibleMessage = visibleMessages.at(-2);
			const isSecondToLast = Array.isArray(secondVisibleMessage)
				? secondVisibleMessage[0].ts === ts
				: secondVisibleMessage?.ts === ts;

			const isLastCollapsedApiReq =
				isLast &&
				lastVisibleMessage?.say === 'api_req_started' &&
				!expandedRows[lastVisibleMessage.ts];

			setExpandedRows((prev) => ({
				...prev,
				[ts]: !prev[ts],
			}));

			// disable auto scroll when user expands row
			if (!isCollapsing) {
				disableAutoScrollRef.current = true;
			}

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
		[visibleMessages, expandedRows, scrollToBottomAuto, isAtBottom],
	);

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
	}, [visibleMessages.length, scrollToBottomSmooth]);

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent;
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				// user scrolled up
				disableAutoScrollRef.current = true;
			}
		}
	}, []);
	useEvent('wheel', handleWheel, window, { passive: true }); // passive improves scrolling performance

	const placeholderText = useMemo(() => {
		const baseText = task ? 'Type a message...' : 'Type your task here...';
		const contextText = '(@ to add context';
		const imageText = shouldDisableImages ? '' : ', hold shift to drag in images';
		const helpText = imageText ? `\n${contextText}${imageText})` : `\n${contextText})`;
		return baseText + helpText;
	}, [task, shouldDisableImages]);

	const itemContent = useCallback(
		(index: number, message: ClineMessage) => {
			return (
				<ChatRow
					key={message.ts}
					message={message}
					isExpanded={expandedRows[message.ts] || false}
					onToggleExpand={() => toggleRowExpansion(message.ts)}
					isLast={index === visibleMessages.length - 1}
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
				/>
			);
		},
		[
			expandedRows,
			modifiedMessages,
			visibleMessages.length,
			handleRowHeightChange,
			isStreaming,
			toggleRowExpansion,
		],
	);

	return (
		<ChatViewContainer>
			{!task && <ChatHistory/>}

			{task && (
				<>
					<TabNavigation />
					<TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						doesModelSupportPromptCache={selectedModelInfo.supportsPromptCache}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						contextTokens={apiMetrics.contextTokens}
						onClose={clearTask}
					/>
					<ScrollContainer ref={scrollContainerRef}>
						<VirtuosoContainer
							ref={virtuosoRef}
							key={task.ts} // trick to make sure virtuoso re-renders when task changes, and we use initialTopMostItemIndex to start at the bottom
							className="scrollable"
							components={{
								Footer: () => <FooterContainer />, // Add empty padding at the bottom
							}}
							// increasing top by 3_000 to prevent jumping around when user collapses a row
							increaseViewportBy={{ top: 3_000, bottom: Number.MAX_SAFE_INTEGER }} // hack to make sure the last message is always rendered to get truly perfect scroll to bottom animation when new messages are added (Number.MAX_SAFE_INTEGER is safe for arithmetic operations, which is all virtuoso uses this value for in src/sizeRangeSystem.ts)
							data={visibleMessages} // messages is the raw format returned by extension, modifiedMessages is the manipulated structure that combines certain messages of related type, and visibleMessages is the filtered structure that removes messages that should not be rendered
							itemContent={itemContent}
							atBottomStateChange={(isAtBottom) => {
								setIsAtBottom(isAtBottom);
								if (isAtBottom) {
									disableAutoScrollRef.current = false;
								}
								setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom);
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
				</>
			)}
			<AutoApproveMenu toolCategories={toolCategories} allowedTools={allowedTools} setAllowedTools={(toolId)=>{
				vscode.postMessage({type: 'setAllowedTools', toolId: toolId});
			}}></AutoApproveMenu>
			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				textAreaDisabled={textAreaDisabled}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				onSend={() => handleSendMessage(inputValue, selectedImages)}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto();
					}
				}}
			/>
		</ChatViewContainer>
	);
};

export default ChatView;
