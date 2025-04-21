import React, { useMemo, useState } from 'react';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { vscode } from '../../utils/vscode';
import styled from 'styled-components';
import { Virtuoso } from 'react-virtuoso';
import { HistoryItem } from '@/shared/HistoryItem';
import { colors } from '../common/styles';

// 样式组件
const HistoryContainer = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
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
  color: ${colors.textSecondary};
  font-weight: 500;
  font-size: 0.75em;
  text-transform: uppercase;
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid ${colors.borderDivider};
`;

const HistoryItemContainer = styled.div<{ $isSelected?: boolean; $isChild?: boolean }>`
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  margin-bottom: 8px;
  padding: 8px;
  margin-left: ${props => props.$isChild ? '20px' : '0'};
  border-left: ${props => props.$isChild ? '2px solid rgba(128, 128, 128, 0.3)' : 'none'};

  &:hover {
    background-color: ${colors.backgroundMuted};
  }

  ${props => props.$isSelected && `
    background-color: ${colors.primaryLight};
  `}
`;

const TaskText = styled.div`
  font-size: 17px;
  color: ${colors.textPrimary};
	font-weight: 400;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
`;

const StyledVirtuoso = styled(Virtuoso)`
  height: 100%;
  width: 100%;
`;

const ParentIcon = styled.span`
  margin-left: 6px;
  font-size: 12px;
  color: ${colors.textSecondary};
`;

const TaskContent = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
`;

type HistoryPreviewNewProps = {
  showHistoryView: () => void;
};

// 定义时间分组的类型
type TimeGroup = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'older';

// 为虚拟滚动定义的列表项类型
type VirtualItem = {
  type: 'header' | 'item' | 'childItem';
  group?: TimeGroup;
  item?: HistoryItem;
  parent?: HistoryItem;
  isExpanded?: boolean;
}

const HistoryPreviewNew: React.FC<HistoryPreviewNewProps> = () => {
	const { taskHistory } = useExtensionState();
	const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

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

	// 查找指定父项的所有子项
	const findChildren = (parentId: string): HistoryItem[] => {
		return taskHistory.filter(item => item.parent === parentId);
	};

	// 切换项目展开/折叠状态
	const toggleItemExpanded = (id: string) => {
		setExpandedItems(prev => ({
			...prev,
			[id]: !prev[id]
		}));
	};

	// 为虚拟滚动准备数据
	const virtualItems = useMemo(() => {
		const items: VirtualItem[] = [];
		const groups: TimeGroup[] = ['today', 'yesterday', 'last7Days', 'last30Days', 'older'];

		// 创建一个映射来跟踪已经添加的项目
		const addedItems = new Set<string>();

		groups.forEach(group => {
			if (groupedHistory[group].length > 0) {
				// 添加组标题
				items.push({ type: 'header', group });

				// 添加组内的历史项（只添加没有父项的条目）
				groupedHistory[group].forEach(item => {
					// 只处理没有父项的条目
					if (!item.parent) {
						items.push({ 
							type: 'item', 
							item,
							isExpanded: expandedItems[item.id]
						});
						addedItems.add(item.id);

						// 如果该项已展开且有子项，则添加其子项
						if (expandedItems[item.id]) {
							const children = findChildren(item.id);
							children.forEach(child => {
								items.push({ 
									type: 'childItem', 
									item: child,
									parent: item
								});
								addedItems.add(child.id);
							});
						}
					}
				});

				// 检查是否有未添加的项目（这些项目的父项不在当前分组中）
				groupedHistory[group].forEach(item => {
					if (item.parent && !addedItems.has(item.id)) {
						const parentItem = taskHistory.find(p => p.id === item.parent);
						// 如果找不到父项或父项未展开，则作为独立项显示
						if (!parentItem || !expandedItems[parentItem.id]) {
							items.push({ type: 'item', item });
							addedItems.add(item.id);
						}
					}
				});
			}
		});

		return items;
	}, [groupedHistory, taskHistory, expandedItems]);

	// 渲染历史记录项（标题或任务项）
	const renderHistoryItem = (index: number, item: VirtualItem) => {
		if (item.type === 'header' && item.group) {
			return <TimeHeader>{getGroupTitle(item.group)}</TimeHeader>;
		} else if ((item.type === 'item' || item.type === 'childItem') && item.item) {
			// 检查是否有子项
			const hasChildren = item.item.children && item.item.children.length > 0;
      
			return (
				<HistoryItemContainer 
					onClick={() => {
						if (item.item) {
							// 无论是什么类型的项目，都发送消息显示任务详情
							handleHistorySelect(item.item.id);
              
							// 如果是父项且有子项，则同时切换展开/折叠状态
							if (item.type === 'item' && hasChildren) {
								toggleItemExpanded(item.item.id);
							}
						}
					}}
					$isChild={item.type === 'childItem'}
				>
					<TaskContent>
						<TaskText>
							{item.item.task}
							{/* 将parentIcon移到末尾 */}
							{hasChildren && (
								<ParentIcon>▼</ParentIcon>
							)}
						</TaskText>
					</TaskContent>
				</HistoryItemContainer>
			);
		}
		return null;
	};

	if (taskHistory.length === 0) {
		return null;
	}

	return (
		<HistoryContainer>
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
