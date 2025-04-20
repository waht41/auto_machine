import React, { useMemo } from 'react';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { vscode } from '../../utils/vscode';
import styled from 'styled-components';
import { Virtuoso } from 'react-virtuoso';

// 样式组件
const HistoryContainer = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const SectionHeader = styled.div`
  color: var(--vscode-descriptionForeground);
  margin: 10px 20px 10px 20px;
  display: flex;
  align-items: center;
`;

const HeaderText = styled.span`
  font-weight: 500;
  font-size: 0.85em;
  text-transform: uppercase;
`;

const HistoryContent = styled.div`
  flex: 1;
  height: 100%;
`;

const CustomScroller = styled.div`
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    background: transparent;
  }

  &:hover::-webkit-scrollbar {
    width: 2px;
    height: 0;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.5);
    border-radius: 1px;
  }
`;

const TimeHeader = styled.div`
  color: var(--vscode-descriptionForeground);
  font-weight: 500;
  font-size: 0.75em;
  text-transform: uppercase;
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
`;

const HistoryItem = styled.div`
  background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 65%, transparent);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  opacity: 0.8;
  cursor: pointer;
  margin-bottom: 8px;
  padding: 8px;

  &:hover {
    background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 100%, transparent);
    opacity: 1;
  }
`;

const TaskText = styled.div`
  font-size: var(--vscode-font-size);
  color: var(--vscode-descriptionForeground);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
`;

const CodiconIcon = styled.span.attrs({ className: 'codicon codicon-comment-discussion' })`
  margin-right: 4px;
  transform: scale(0.9);
`;

const StyledVirtuoso = styled(Virtuoso)`
  height: 100%;
  width: 100%;
`;

type HistoryPreviewNewProps = {
  showHistoryView: () => void;
};

interface HistoryItem {
  id: string;
  ts: number;
  task: string;
}

// 定义时间分组的类型
type TimeGroup = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'older';

// 为虚拟滚动定义的列表项类型
type VirtualItem = {
  type: 'header' | 'item';
  group?: TimeGroup;
  item?: HistoryItem;
}

const HistoryPreviewNew: React.FC<HistoryPreviewNewProps> = () => {
	const { taskHistory } = useExtensionState();

	// 按时间分组历史记录
	const groupedHistory = useMemo(() => {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterday = new Date(today);
		yesterday.setDate(today.getDate() - 1);
		const last7Days = new Date(today);
		last7Days.setDate(today.getDate() - 7);
		const last30Days = new Date(today);
		last30Days.setDate(today.getDate() - 30);

		const groups: Record<TimeGroup, HistoryItem[]> = {
			today: [],
			yesterday: [],
			last7Days: [],
			last30Days: [],
			older: [],
		};

		taskHistory
			.filter((item) => item.ts && item.task)
			.sort((a, b) => b.ts - a.ts) // 按时间降序排序
			.forEach((item) => {
				const itemDate = new Date(item.ts);

				if (itemDate >= today) {
					groups.today.push(item);
				} else if (itemDate >= yesterday) {
					groups.yesterday.push(item);
				} else if (itemDate >= last7Days) {
					groups.last7Days.push(item);
				} else if (itemDate >= last30Days) {
					groups.last30Days.push(item);
				} else {
					groups.older.push(item);
				}
			});

		return groups;
	}, [taskHistory]);

	// 处理选择历史记录的事件
	const handleHistorySelect = (id: string) => {
		vscode.postMessage({ type: 'showTaskWithId', text: id });
	};

	// 获取分组标题
	const getGroupTitle = (group: TimeGroup): string => {
		switch (group) {
			case 'today':
				return 'Today';
			case 'yesterday':
				return 'Yesterday';
			case 'last7Days':
				return 'Last 7 Days';
			case 'last30Days':
				return 'Last 30 Days';
			case 'older':
				return 'Older';
		}
	};

	// 为虚拟滚动准备数据
	const virtualItems = useMemo(() => {
		const items: VirtualItem[] = [];

		const groups: TimeGroup[] = ['today', 'yesterday', 'last7Days', 'last30Days', 'older'];

		groups.forEach(group => {
			if (groupedHistory[group].length > 0) {
				// 添加组标题
				items.push({ type: 'header', group });

				// 添加组内的历史项
				groupedHistory[group].forEach(item => {
					items.push({ type: 'item', item });
				});
			}
		});

		return items;
	}, [groupedHistory]);

	// 渲染历史记录项（标题或任务项）
	const renderHistoryItem = (index: number, item: VirtualItem) => {
		if (item.type === 'header' && item.group) {
			return <TimeHeader>{getGroupTitle(item.group)}</TimeHeader>;
		} else if (item.type === 'item' && item.item) {
			return (
				<HistoryItem onClick={() => handleHistorySelect(item.item!.id)}>
					<TaskText>{item.item.task}</TaskText>
				</HistoryItem>
			);
		}
		return null;
	};

	if (taskHistory.length === 0) {
		return null;
	}

	return (
		<HistoryContainer>
			<SectionHeader>
				<CodiconIcon />
				<HeaderText>Recent Tasks</HeaderText>
			</SectionHeader>
			<HistoryContent>
				<StyledVirtuoso
					totalCount={virtualItems.length}
					itemContent={index => renderHistoryItem(index, virtualItems[index])}
					overscan={20}
					components={{ Scroller: CustomScroller }}
				/>
			</HistoryContent>
		</HistoryContainer>
	);
};

export default React.memo(HistoryPreviewNew);
