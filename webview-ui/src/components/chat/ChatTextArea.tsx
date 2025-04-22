import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DynamicTextArea from 'react-textarea-autosize';
import { mentionRegex, mentionRegexGlobal } from '@/shared/context-mentions';
import { useExtensionState } from '../../context/ExtensionStateContext';
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu
} from '../../utils/context-mentions';
import { MAX_IMAGES_PER_MESSAGE } from './ChatView';
import ContextMenu from './ContextMenu';
import Thumbnails from '../common/Thumbnails';
import { vscode } from '../../utils/vscode';
import { WebviewMessage } from '@/shared/WebviewMessage';
import styled from 'styled-components';
import { ApprovalButton } from './AutoApproveMenu';
import { ReactComponent as EnhanceIcon } from '@webview-ui/assets/enhanceIcon.svg';
import { ReactComponent as ArrowUp } from '@webview-ui/assets/ArrowUp.svg';
import { Button } from 'antd';
import { colors } from '../common/styles';
import SVGComponent from '@webview-ui/components/common/SVGComponent';

interface HighlightLayerProps {
	$thumbnailsHeight: number;
}

interface StyledTextAreaProps {
	$disabled?: boolean;
	$thumbnailsHeight: number;
}

interface IconButtonProps {
	$fontSize?: string;
	$disabled?: boolean;
}

interface StyledEnhanceButtonProps {
  $disabled?: boolean;
}

const ChatTextAreaContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: ${colors.backgroundPanel};
  margin: 10px 15px;
  padding: 32px 24px 24px 24px;
  border: 1px solid ${colors.borderDivider};
  border-radius: 24px;
  box-shadow: 0 2px 20px 0 rgba(0, 0, 0, 0.08);
`;
const TextAreaWrapper = styled.div`
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column-reverse;
  min-height: 0;
  overflow: hidden;
`;

const HighlightLayer = styled.div<HighlightLayerProps>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: transparent;
  overflow: hidden;
  padding: 8px;
  margin-bottom: ${props => props.$thumbnailsHeight > 0 ? `${props.$thumbnailsHeight + 16}px` : 0};
  z-index: 1;
`;

const StyledTextArea = styled(DynamicTextArea)<StyledTextAreaProps>`
  width: 100%;

  box-sizing: border-box;
  background-color: transparent;
  color: ${colors.textPrimary};
  border-radius: 2px;
	font-size: 16px;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  border: none;
  padding: 8px;
  margin-bottom: ${props => props.$thumbnailsHeight > 0 ? `${props.$thumbnailsHeight + 16}px` : 0};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'text'};
  flex: 0 1 auto;
  z-index: 2;
`;

const StyledThumbnails = styled(Thumbnails)`
  position: absolute;
  bottom: 36px;
  left: 16px;
  z-index: 2;
  margin-bottom: 8px;
`;

const ControlsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 8px;
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
`;

const ButtonWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const LoadingIcon = styled.span`
  color: ${colors.primary};
  opacity: 0.5;
  font-size: 16.5px;
  margin-right: 10px;
`;

const IconButton = styled.span<IconButtonProps>`
  font-size: ${props => props.$fontSize || '16.5px'};

  &.disabled, ${props => props.$disabled ? '&' : ''} {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledEnhanceButton = styled(Button)<StyledEnhanceButtonProps>`
  padding: 4px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  
  &:hover, &:focus {
    background: transparent;
    border: none;
  }
`;

const SendButton = styled(Button)`
  border-radius: 50%;
  background: ${colors.primary};
  height: 48px;
  width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  transition: all 0.3s ease;
  
  &:hover, &:focus {
    background: ${colors.primaryHover} !important;
    border: none;
  }
`;

const CancelIcon = styled.div`
  background: ${colors.backgroundPanel};
	height: 13px;
	width: 13px;
`;

interface ChatTextAreaProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	textAreaDisabled: boolean;
	placeholderText: string;
	selectedImages: string[];
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>;
	onSend: () => void;
	onCancel: ()	=> void;
	onSelectImages: () => void;
	shouldDisableImages: boolean;
	onHeightChange?: (height: number) => void;
	allowedTools: any[];
	toolCategories: any[];
}

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onCancel,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			allowedTools,
			toolCategories,
		},
		ref
	) => {
		const { filePaths } = useExtensionState();
		const [gitCommits, setGitCommits] = useState<any[]>([]);
		const [showDropdown, setShowDropdown] = useState(false);

		// Close dropdown when clicking outside
		useEffect(() => {
			const handleClickOutside = () => {
				if (showDropdown) {
					setShowDropdown(false);
				}
			};
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}, [showDropdown]);

		// Handle enhanced prompt response
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data;
				if (message.type === 'enhancedPrompt') {
					if (message.text) {
						setInputValue(message.text);
					}
					setIsEnhancingPrompt(false);
				} else if (message.type === 'commitSearchResults') {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: '$(git-commit)'
					}));
					setGitCommits(commits);
				}
			};
			window.addEventListener('message', messageHandler);
			return () => window.removeEventListener('message', messageHandler);
		}, [setInputValue]);

		const [thumbnailsHeight, setThumbnailsHeight] = useState(0);
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined);
		const [showContextMenu, setShowContextMenu] = useState(false);
		const [cursorPosition, setCursorPosition] = useState(0);
		const [searchQuery, setSearchQuery] = useState('');
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false);
		const highlightLayerRef = useRef<HTMLDivElement>(null);
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1);
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null);
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false);
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null);
		const contextMenuContainerRef = useRef<HTMLDivElement>(null);
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

		// Fetch git commits when Git is selected or when typing a hash
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: 'searchCommits',
					query: searchQuery || ''
				} as const;
				vscode.postMessage(message);
			}
		}, [selectedType, searchQuery]);

		const handleEnhancePrompt = useCallback(() => {
			if (!textAreaDisabled) {
				const trimmedInput = inputValue.trim();
				if (trimmedInput) {
					setIsEnhancingPrompt(true);
					const message = {
						type: 'enhancePrompt' as const,
						text: trimmedInput
					};
					vscode.postMessage(message);
				} else {
					const promptDescription =
						'The \'Enhance Prompt\' button helps improve your prompt by providing additional context, clarification, or rephrasing. Try typing a prompt in here and clicking the button again to see how it works.';
					setInputValue(promptDescription);
				}
			}
		}, [inputValue, textAreaDisabled, setInputValue]);

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: 'problems' },
				...gitCommits,
				...filePaths
					.map((file) => '/' + file)
					.map((path) => ({
						type: path.endsWith('/') ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path
					}))
			];
		}, [filePaths, gitCommits]);

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false);
				}
			};

			if (showContextMenu) {
				document.addEventListener('mousedown', handleClickOutside);
			}

			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}, [showContextMenu, setShowContextMenu]);

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return;
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type);
						setSearchQuery('');
						setSelectedMenuIndex(0);
						return;
					}
				}

				setShowContextMenu(false);
				setSelectedType(null);
				if (textAreaRef.current) {
					let insertValue = value || '';
					if (type === ContextMenuOptionType.URL) {
						insertValue = value || '';
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || '';
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = 'problems';
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || '';
					}

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						cursorPosition,
						insertValue
					);

					setInputValue(newValue);
					const newCursorPosition = newValue.indexOf(' ', mentionIndex + insertValue.length) + 1;
					setCursorPosition(newCursorPosition);
					setIntendedCursorPosition(newCursorPosition);

					// scroll to cursor
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur();
							textAreaRef.current.focus();
						}
					}, 0);
				}
			},
			[setInputValue, cursorPosition]
		);

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === 'Escape') {
						setSelectedType(null);
						setSelectedMenuIndex(3); // File by default
						return;
					}

					if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
						event.preventDefault();
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === 'ArrowUp' ? -1 : 1;
							const options = getContextMenuOptions(searchQuery, selectedType, queryItems);
							const optionsLength = options.length;

							if (optionsLength === 0) return prevIndex;

							// Find selectable options (non-URL types)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults
							);

							if (selectableOptions.length === 0) return -1; // No selectable options

							// Find the index of the next selectable option
							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex]
							);

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length;

							// Find the index of the selected option in the original options array
							return options.findIndex((option) => option === selectableOptions[newSelectableIndex]);
						});
						return;
					}
					if ((event.key === 'Enter' || event.key === 'Tab') && selectedMenuIndex !== -1) {
						event.preventDefault();
						const selectedOption = getContextMenuOptions(searchQuery, selectedType, queryItems)[
							selectedMenuIndex
						];
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value);
						}
						return;
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false;
				if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
					event.preventDefault();
					onSend();
				}

				if (event.key === 'Backspace' && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1];
					const charAfterCursor = inputValue[cursorPosition + 1];

					const charBeforeIsWhitespace =
						charBeforeCursor === ' ' || charBeforeCursor === '\n' || charBeforeCursor === '\r\n';
					const charAfterIsWhitespace =
						charAfterCursor === ' ' || charAfterCursor === '\n' || charAfterCursor === '\r\n';
					// checks if char before cusor is whitespace after a mention
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + '$')) // "$" is added to ensure the match occurs at the end of the string
					) {
						const newCursorPosition = cursorPosition - 1;
						// if mention is followed by another word, then instead of deleting the space separating them we just move the cursor to the end of the mention
						if (!charAfterIsWhitespace) {
							event.preventDefault();
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
							setCursorPosition(newCursorPosition);
						}
						setCursorPosition(newCursorPosition);
						setJustDeletedSpaceAfterMention(true);
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition);
						if (newText !== inputValue) {
							event.preventDefault();
							setInputValue(newText);
							setIntendedCursorPosition(newPosition); // Store the new cursor position in state
						}
						setJustDeletedSpaceAfterMention(false);
						setShowContextMenu(false);
					} else {
						setJustDeletedSpaceAfterMention(false);
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems
			]
		);

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition);
				setIntendedCursorPosition(null); // Reset the state
			}
		}, [inputValue, intendedCursorPosition]);

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value;
				const newCursorPosition = e.target.selectionStart;
				setInputValue(newValue);
				setCursorPosition(newCursorPosition);
				const showMenu = shouldShowContextMenu(newValue, newCursorPosition);

				setShowContextMenu(showMenu);
				if (showMenu) {
					const lastAtIndex = newValue.lastIndexOf('@', newCursorPosition - 1);
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition);
					setSearchQuery(query);
					if (query.length > 0) {
						setSelectedMenuIndex(0);
					} else {
						setSelectedMenuIndex(3); // Set to "File" option by default
					}
				} else {
					setSearchQuery('');
					setSelectedMenuIndex(-1);
				}
			},
			[setInputValue]
		);

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null);
			}
		}, [showContextMenu]);

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false);
			}
		}, [isMouseDownOnMenu]);

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items;

				const pastedText = e.clipboardData.getData('text');
				// Check if the pasted content is a URL, add space after so user can easily delete if they don't want it
				const urlRegex = /^\S+:\/\/\S+$/;
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault();
					const trimmedUrl = pastedText.trim();
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + ' ' + inputValue.slice(cursorPosition);
					setInputValue(newValue);
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1;
					setCursorPosition(newCursorPosition);
					setIntendedCursorPosition(newCursorPosition);
					setShowContextMenu(false);

					// Scroll to new cursor position
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur();
							textAreaRef.current.focus();
						}
					}, 0);

					return;
				}

				const acceptedTypes = ['png', 'jpeg', 'webp'];
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split('/');
					return type === 'image' && acceptedTypes.includes(subtype);
				});
				if (!shouldDisableImages && imageItems.length > 0) {
					e.preventDefault();
					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile();
							if (!blob) {
								resolve(null);
								return;
							}
							const reader = new FileReader();
							reader.onloadend = () => {
								if (reader.error) {
									console.error('Error reading file:', reader.error);
									resolve(null);
								} else {
									const result = reader.result;
									resolve(typeof result === 'string' ? result : null);
								}
							};
							reader.readAsDataURL(blob);
						});
					});
					const imageDataArray = await Promise.all(imagePromises);
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null);
					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE));
					} else {
						console.warn('No valid images were processed');
					}
				}
			},
			[shouldDisableImages, setSelectedImages, cursorPosition, setInputValue, inputValue]
		);

		const handleThumbnailsHeightChange = useCallback((height: number) => {
			setThumbnailsHeight(height);
		}, []);

		useEffect(() => {
			if (selectedImages.length === 0) {
				setThumbnailsHeight(0);
			}
		}, [selectedImages]);

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true);
		}, []);

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return;

			const text = textAreaRef.current.value;

			highlightLayerRef.current.innerHTML = text
				.replace(/\n$/, '\n\n')
				.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c)
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>');

			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop;
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft;
		}, []);

		useLayoutEffect(() => {
			updateHighlights();
		}, [inputValue, updateHighlights]);

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart);
			}
		}, []);

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
					updateCursorPosition();
				}
			},
			[updateCursorPosition]
		);

		return (
			<ChatTextAreaContainer
				onDrop={async (e) => {
					e.preventDefault();
					const files = Array.from(e.dataTransfer.files);
					const text = e.dataTransfer.getData('text');
					if (text) {
						const newValue = inputValue.slice(0, cursorPosition) + text + inputValue.slice(cursorPosition);
						setInputValue(newValue);
						const newCursorPosition = cursorPosition + text.length;
						setCursorPosition(newCursorPosition);
						setIntendedCursorPosition(newCursorPosition);
						return;
					}
					const acceptedTypes = ['png', 'jpeg', 'webp'];
					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split('/');
						return type === 'image' && acceptedTypes.includes(subtype);
					});
					if (!shouldDisableImages && imageFiles.length > 0) {
						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
								const reader = new FileReader();
								reader.onloadend = () => {
									if (reader.error) {
										console.error('Error reading file:', reader.error);
										resolve(null);
									} else {
										const result = reader.result;
										resolve(typeof result === 'string' ? result : null);
									}
								};
								reader.readAsDataURL(file);
							});
						});
						const imageDataArray = await Promise.all(imagePromises);
						const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null);
						if (dataUrls.length > 0) {
							setSelectedImages((prevImages) =>
								[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE)
							);
							if (typeof vscode !== 'undefined') {
								vscode.postMessage({
									type: 'draggedImages',
									dataUrls: dataUrls
								});
							}
						} else {
							console.warn('No valid images were processed');
						}
					}
				}}
				onDragOver={(e) => {
					e.preventDefault();
				}}>
				{showContextMenu && (
					<div ref={contextMenuContainerRef}>
						<ContextMenu
							onSelect={handleMentionSelect}
							searchQuery={searchQuery}
							onMouseDown={handleMenuMouseDown}
							selectedIndex={selectedMenuIndex}
							setSelectedIndex={setSelectedMenuIndex}
							selectedType={selectedType}
							queryItems={queryItems}
						/>
					</div>
				)}

				<TextAreaWrapper>
					<HighlightLayer
						ref={highlightLayerRef}
						$thumbnailsHeight={thumbnailsHeight}
					/>
					<StyledTextArea
						ref={(el) => {
							if (typeof ref === 'function') {
								ref(el);
							} else if (ref) {
								ref.current = el;
							}
							textAreaRef.current = el;
						}}
						value={inputValue}
						$disabled={textAreaDisabled}
						$thumbnailsHeight={thumbnailsHeight}
						onChange={(e) => {
							handleInputChange(e);
							updateHighlights();
						}}
						onKeyDown={handleKeyDown}
						onKeyUp={handleKeyUp}
						onBlur={handleBlur}
						onPaste={handlePaste}
						onSelect={updateCursorPosition}
						onMouseUp={updateCursorPosition}
						onHeightChange={(height) => {
							if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
								setTextAreaBaseHeight(height);
							}
							onHeightChange?.(height);
						}}
						placeholder={placeholderText}
						minRows={2}
						maxRows={20}
						autoFocus={true}
						onScroll={() => updateHighlights()}
					/>
				</TextAreaWrapper>

				{selectedImages.length > 0 && (
					<StyledThumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
					/>
				)}

				<ControlsContainer>
					<ButtonGroup>
						<ButtonWrapper>
							<ApprovalButton
								allowedTools={allowedTools}
								toolCategories={toolCategories}
								setAllowedTools={(toolId) => {
									vscode.postMessage({type: 'setAllowedTools', toolId: toolId});
								}}
							/>
							{isEnhancingPrompt ? (
								<LoadingIcon className="codicon codicon-loading codicon-modifier-spin" />
							) : (
								<StyledEnhanceButton type={'text'} onClick={() => !textAreaDisabled && handleEnhancePrompt()} $disabled={textAreaDisabled}>
									<SVGComponent component={EnhanceIcon} width={20} height={20}/>
								</StyledEnhanceButton>
							)}
						</ButtonWrapper>
					</ButtonGroup>
					<ButtonGroup>
						<IconButton
							className={`input-icon-button ${shouldDisableImages ? 'disabled' : ''} codicon codicon-device-camera`}
							style={{display: 'none'}} //todo 之后记得加回来
							$fontSize="16.5px"
							$disabled={shouldDisableImages}
							onClick={() => !shouldDisableImages && onSelectImages()}
						/>
						<SendButton 
							type="primary" 
							onClick={() => {
								if (!textAreaDisabled) {
									onSend();
								} else {
									onCancel();
								}

							}}
						>
							{!textAreaDisabled && <SVGComponent component={ArrowUp} width={12} height={16}/>}
							{textAreaDisabled && <CancelIcon/>}
						</SendButton>
					</ButtonGroup>
				</ControlsContainer>
			</ChatTextAreaContainer>
		);
	}
);

export default ChatTextArea;
