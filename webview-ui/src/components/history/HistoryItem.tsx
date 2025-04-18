import React, { memo } from 'react';
import styled from 'styled-components';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { formatLargeNumber } from '../../utils/format';
import { vscode } from '../../utils/vscode';

// 样式化组件
const HistoryItem = styled.div<{ $isLast: boolean }>`
	cursor: pointer;
	border-bottom: ${props => props.$isLast ? 'none' : '1px solid var(--vscode-panel-border)'};
	
	&:hover {
		background-color: var(--vscode-list-hoverBackground);
	}
	
	&:hover .delete-button,
	&:hover .export-button,
	&:hover .copy-button {
		opacity: 1;
		pointer-events: auto;
	}
`;

const ItemContent = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 20px;
	position: relative;
`;

const ItemHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const DateLabel = styled.span`
	color: var(--vscode-descriptionForeground);
	font-weight: 500;
	font-size: 0.85em;
	text-transform: uppercase;
`;

const ButtonGroup = styled.div`
	display: flex;
	gap: 4px;
`;

const ActionButton = styled.button`
`;

const TaskText = styled.div`
	font-size: var(--vscode-font-size);
	color: var(--vscode-foreground);
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	white-space: pre-wrap;
	word-break: break-word;
	overflow-wrap: anywhere;
`;

const MetadataContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

const TokensContainer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const TokensGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
`;

const MetadataLabel = styled.span`
	font-weight: 500;
	color: var(--vscode-descriptionForeground);
`;

const TokenValue = styled.span`
	display: flex;
	align-items: center;
	gap: 3px;
	color: var(--vscode-descriptionForeground);
`;

const CacheContainer = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
`;

const CostContainer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: -2px;
`;

const CostGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
`;

const Icon = styled.i<{ size?: string, marginBottom?: string }>`
	font-size: ${props => props.size || '12px'};
	font-weight: bold;
	margin-bottom: ${props => props.marginBottom || '0'};
`;

// 导出按钮组件
export const ExportButton = ({ itemId }: { itemId: string }) => (
	<VSCodeButton
		className="export-button"
		appearance="icon"
		onClick={(e) => {
			e.stopPropagation();
			vscode.postMessage({ type: 'exportTaskWithId', text: itemId });
		}}>
		<div style={{ fontSize: '11px', fontWeight: 500 }}>EXPORT</div>
	</VSCodeButton>
);

// 历史项目组件类型定义
export interface HistoryItemProps {
	item: any;
	index: number;
	totalItems: number;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
	onCopy: (e: React.MouseEvent, task: string) => void;
}

// 历史项目组件
const HistoryItemComponent = memo(({ 
	item, 
	index, 
	totalItems, 
	onSelect, 
	onDelete, 
	onCopy 
}: HistoryItemProps) => {
	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date
			?.toLocaleString('en-US', {
				month: 'long',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			})
			.replace(', ', ' ')
			.replace(' at', ',')
			.toUpperCase();
	};

	return (
		<HistoryItem 
			$isLast={index === totalItems - 1}
			onClick={() => onSelect(item.id)}
			data-testid={`task-item-${item.id}`}
			className="history-item"
		>
			<ItemContent>
				<ItemHeader>
					<DateLabel>{formatDate(item.ts)}</DateLabel>
					<ButtonGroup>
						<ActionButton
							title="Copy Prompt"
							className="copy-button"
							data-appearance="icon"
							onClick={(e) => onCopy(e, item.task)}>
							<span className="codicon codicon-copy"></span>
						</ActionButton>
						<ActionButton
							title="Delete Task"
							className="delete-button"
							data-appearance="icon"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(item.id);
							}}>
							<span className="codicon codicon-trash"></span>
						</ActionButton>
					</ButtonGroup>
				</ItemHeader>
				
				<TaskText dangerouslySetInnerHTML={{ __html: item.task }} />
				
				<MetadataContainer>
					<TokensContainer data-testid="tokens-container">
						<TokensGroup>
							<MetadataLabel>Tokens:</MetadataLabel>
							<TokenValue data-testid="tokens-in">
								<Icon className="codicon codicon-arrow-up" marginBottom="-2px" />
								{formatLargeNumber(item.tokensIn || 0)}
							</TokenValue>
							<TokenValue data-testid="tokens-out">
								<Icon className="codicon codicon-arrow-down" marginBottom="-2px" />
								{formatLargeNumber(item.tokensOut || 0)}
							</TokenValue>
						</TokensGroup>
						{!item.totalCost && <ExportButton itemId={item.id} />}
					</TokensContainer>

					{!!item.cacheWrites && (
						<CacheContainer data-testid="cache-container">
							<MetadataLabel>Cache:</MetadataLabel>
							<TokenValue data-testid="cache-writes">
								<Icon className="codicon codicon-database" marginBottom="-1px" />
								+{formatLargeNumber(item.cacheWrites || 0)}
							</TokenValue>
							<TokenValue data-testid="cache-reads">
								<Icon className="codicon codicon-arrow-right" />
								{formatLargeNumber(item.cacheReads || 0)}
							</TokenValue>
						</CacheContainer>
					)}
					
					{!!item.totalCost && (
						<CostContainer>
							<CostGroup>
								<MetadataLabel>API Cost:</MetadataLabel>
								<span style={{ color: 'var(--vscode-descriptionForeground)' }}>
									${item.totalCost?.toFixed(4)}
								</span>
							</CostGroup>
							<ExportButton itemId={item.id} />
						</CostContainer>
					)}
				</MetadataContainer>
			</ItemContent>
		</HistoryItem>
	);
});

export default HistoryItemComponent;
