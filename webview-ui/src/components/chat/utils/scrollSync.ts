import { VirtuosoHandle } from 'react-virtuoso';
import { ClineMessage } from '@/shared/ExtensionMessage';

/**
 * 查找第一个大于目标时间戳的消息索引
 * @param messages 消息数组
 * @param targetTs 目标时间戳
 * @returns 最接近的消息索引
 */
export const findNearestMessageIndex = (
	messages: ClineMessage[],
	targetTs: number
): number => {
	return messages.findIndex(message => message.ts > targetTs);
};

/**
 * 滚动到一个大于目标时间戳的消息索引
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

/**
 * 通过消息ID查找对应的消息索引
 * @param messages 消息数组
 * @param messageId 消息ID
 * @returns 对应的消息索引，如果未找到则返回-1
 */
export const findMessageIndexById = (
	messages: ClineMessage[],
	messageId: number
): number => {
	return messages.findIndex(message => message.messageId === messageId);
};

/**
 * 滚动到指定ID的消息
 * @param virtuosoRef Virtuoso组件的引用
 * @param messages 消息数组
 * @param messageId 消息ID
 * @param behavior 滚动行为
 */
export const scrollToMessageById = (
	virtuosoRef: React.RefObject<VirtuosoHandle>,
	messages: ClineMessage[],
	messageId: number,
	behavior: 'auto' | 'smooth' = 'smooth'
): void => {
	if (!virtuosoRef.current || messages.length === 0) return;

	const messageIndex = findMessageIndexById(messages, messageId);

	if (messageIndex >= 0) {
		virtuosoRef.current.scrollToIndex({
			index: messageIndex,
			behavior: behavior || 'smooth', // 确保默认使用平滑滚动
			align: 'start',
		});
	}
};
