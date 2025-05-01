import { VSCodeButton, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { vscode } from '../../utils/vscode';
import { Virtuoso } from 'react-virtuoso';
import React, { memo, useMemo, useState, useEffect } from 'react';
import { Fzf } from 'fzf';
import { highlightFzfMatch } from '../../utils/highlight';
import { Radio } from 'antd';
import styled from 'styled-components';
import HistoryItemComponent from './HistoryItem';

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = 'newest' | 'oldest' | 'mostExpensive' | 'mostTokens' | 'mostRelevant'

// 样式化组件
const Container = styled.div`
	display: flex;
	height: 100%;
	flex-direction: column;
	overflow: hidden;
`;

const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 17px 10px 20px;
`;

const HeaderTitle = styled.h3`
	color: var(--vscode-foreground);
	margin: 0;
`;

const SearchContainer = styled.div`
	padding: 5px 17px 6px 17px;
`;

const SearchControls = styled.div`
	display: flex;
	flex-direction: column;
	gap: 6px;
`;

const ListContainer = styled.div`
	flex-grow: 1;
	overflow: hidden;
	margin: 0;
`;

const VirtuosoContainer = styled.div`
	flex-grow: 1;
	overflow-y: auto;
`;

const CopyModal = styled.div`
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	background-color: var(--vscode-notifications-background);
	color: var(--vscode-notifications-foreground);
	padding: 12px 20px;
	border-radius: 4px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	z-index: 1000;
	transition: opacity 0.2s ease-in-out;
`;

const SearchIcon = styled.div`
	font-size: 13px;
	margin-top: 2.5px;
	opacity: 0.8;
`;

const ClearButton = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
`;

// 搜索和排序组件
const SearchAndSort = memo(({ 
	searchQuery, 
	setSearchQuery, 
	sortOption, 
	setSortOption 
}: { 
	searchQuery: string, 
	setSearchQuery: (query: string) => void, 
	sortOption: SortOption, 
	setSortOption: (option: SortOption) => void 
}) => {
	return (
		<SearchContainer>
			<SearchControls>
				<VSCodeTextField
					style={{ width: '100%' }}
					placeholder="Fuzzy search history..."
					value={searchQuery}
					onInput={(e) => {
						const newValue = (e.target as HTMLInputElement)?.value;
						setSearchQuery(newValue);
					}}>
					<SearchIcon slot="start" className="codicon codicon-search" />
					{searchQuery && (
						<ClearButton
							className="input-icon-button codicon codicon-close"
							aria-label="Clear search"
							onClick={() => setSearchQuery('')}
							slot="end"
						/>
					)}
				</VSCodeTextField>
				<Radio.Group
					style={{ display: 'flex', flexWrap: 'wrap' }}
					value={sortOption}
					onChange={(e) => setSortOption(e.target.value as SortOption)}>
					<Radio value="newest">Newest</Radio>
					<Radio value="oldest">Oldest</Radio>
					<Radio value="mostExpensive">Most Expensive</Radio>
					<Radio value="mostTokens">Most Tokens</Radio>
					<Radio
						value="mostRelevant"
						disabled={!searchQuery}
						style={{ opacity: searchQuery ? 1 : 0.5 }}>
						Most Relevant
					</Radio>
				</Radio.Group>
			</SearchControls>
		</SearchContainer>
	);
});

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const { taskHistory } = useExtensionState();
	const [searchQuery, setSearchQuery] = useState('');
	const [sortOption, setSortOption] = useState<SortOption>('newest');
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>('newest');
	const [showCopyModal, setShowCopyModal] = useState(false);

	useEffect(() => {
		if (searchQuery && sortOption !== 'mostRelevant' && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption);
			setSortOption('mostRelevant');
		} else if (!searchQuery && sortOption === 'mostRelevant' && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort);
			setLastNonRelevantSort(null);
		}
	}, [searchQuery, sortOption, lastNonRelevantSort]);

	const handleHistorySelect = (id: string) => {
		vscode.postMessage({ type: 'showTaskWithId', text: id });
	};

	const handleDeleteHistoryItem = (id: string) => {
		vscode.postMessage({ type: 'deleteTaskWithId', text: id });
	};

	const handleCopyTask = async (e: React.MouseEvent, task: string) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(task);
			setShowCopyModal(true);
			setTimeout(() => setShowCopyModal(false), 2000);
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
		}
	};

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task);
	}, [taskHistory]);

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => item.task,
		});
	}, [presentableTasks]);

	const taskHistorySearchResults = useMemo(() => {
		let results = presentableTasks;
		if (searchQuery) {
			const searchResults = fzf.find(searchQuery);
			results = searchResults.map((result) => ({
				...result.item,
				task: highlightFzfMatch(result.item.task, Array.from(result.positions)),
			}));
		}

		// First apply search if needed
		const searchResults = searchQuery ? results : presentableTasks;

		// Then sort the results
		return [...searchResults].sort((a, b) => {
			switch (sortOption) {
				case 'oldest':
					return (a.ts || 0) - (b.ts || 0);
				case 'mostExpensive':
					return (b.totalCost || 0) - (a.totalCost || 0);
				case 'mostTokens':
					const aTokens = (a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0);
					const bTokens = (b.tokensIn || 0) + (b.tokensOut || 0) + (b.cacheWrites || 0) + (b.cacheReads || 0);
					return bTokens - aTokens;
				case 'mostRelevant':
					// Keep fuse order if searching, otherwise sort by newest
					return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0);
				case 'newest':
				default:
					return (b.ts || 0) - (a.ts || 0);
			}
		});
	}, [presentableTasks, searchQuery, fzf, sortOption]);

	return (
		<>
			<style>
				{`
					.history-item-highlight {
						background-color: var(--vscode-editor-findMatchHighlightBackground);
						color: inherit;
					}
					.delete-button, .export-button, .copy-button {
						opacity: 0;
						pointer-events: none;
					}
					.history-item:hover .delete-button,
					.history-item:hover .export-button,
					.history-item:hover .copy-button {
						opacity: 1;
						pointer-events: auto;
					}
				`}
			</style>
			{showCopyModal && <CopyModal>Prompt Copied to Clipboard</CopyModal>}
			<Container>
				<Header>
					<HeaderTitle>History</HeaderTitle>
					<VSCodeButton onClick={onDone}>Done</VSCodeButton>
				</Header>
				
				<SearchAndSort
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					sortOption={sortOption}
					setSortOption={setSortOption}
				/>
				
				<ListContainer>
					<Virtuoso
						style={{ height: '100%' }}
						data={taskHistorySearchResults}
						data-testid="virtuoso-container"
						components={{
							List: React.forwardRef((props, ref) => (
								<VirtuosoContainer {...props} ref={ref} data-testid="virtuoso-item-list" />
							)),
						}}
						itemContent={(index, item) => (
							<HistoryItemComponent
								item={item}
								index={index}
								totalItems={taskHistorySearchResults.length}
								onSelect={handleHistorySelect}
								onDelete={handleDeleteHistoryItem}
								onCopy={handleCopyTask}
							/>
						)}
					/>
				</ListContainer>
			</Container>
		</>
	);
};

export default memo(HistoryView);
