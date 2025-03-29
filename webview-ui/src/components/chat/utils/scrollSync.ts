import { VirtuosoHandle } from 'react-virtuoso';
import { ClineMessage } from '@/shared/ExtensionMessage';

/**
 * 查找最接近指定时间戳的消息索引
 * @param messages 消息数组
 * @param targetTs 目标时间戳
 * @returns 最接近的消息索引
 */
export const findNearestMessageIndex = (
	messages: ClineMessage[],
	targetTs: number
): number => {
	if (messages.length === 0) return -1;
  
	// 如果目标时间戳小于第一条消息的时间戳，返回第一条消息
	if (targetTs <= messages[0].ts) return 0;
  
	// 如果目标时间戳大于最后一条消息的时间戳，返回最后一条消息
	if (targetTs >= messages[messages.length - 1].ts) return messages.length - 1;
  
	// 二分查找最接近的消息
	let left = 0;
	let right = messages.length - 1;
  
	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
    
		if (messages[mid].ts === targetTs) {
			return mid; // 找到精确匹配
		}
    
		if (messages[mid].ts < targetTs) {
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}
  
	// 此时 left 指向大于 targetTs 的第一个元素，right 指向小于 targetTs 的最后一个元素
	// 比较哪个更接近目标时间戳
	if (right < 0) return 0;
	if (left >= messages.length) return messages.length - 1;
  
	const diffLeft = Math.abs(messages[left].ts - targetTs);
	const diffRight = Math.abs(messages[right].ts - targetTs);
  
	return diffLeft < diffRight ? left : right;
};

/**
 * 滚动到最接近指定时间戳的消息
 * @param virtuosoRef Virtuoso组件的引用
 * @param messages 消息数组
 * @param targetTs 目标时间戳
 * @param behavior 滚动行为
 */
export const scrollToNearestTs = (
	virtuosoRef: React.RefObject<VirtuosoHandle>,
	messages: ClineMessage[],
	targetTs: number,
	behavior: 'auto' | 'smooth' = 'smooth'
): void => {
	if (!virtuosoRef.current || messages.length === 0) return;
  
	const nearestIndex = findNearestMessageIndex(messages, targetTs);
  
	if (nearestIndex >= 0) {
		virtuosoRef.current.scrollToIndex({
			index: nearestIndex,
			behavior: behavior || 'smooth', // 确保默认使用平滑滚动
			align: 'start',
		});
	}
};
