import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ExtensionMessage } from '@/shared/ExtensionMessage';
import messageBus from './messageBus';
import { BACKGROUND_MESSAGE } from './const';
import { BackGroundMessageHandler, InternalPrompt, SharedContext } from './type';
import { createListeners } from './createDerivedState';
import { AssistantStructure } from '@core/storage/type';

// 定义状态接口
interface IStateStore {
	// 原始状态
	state: SharedContext | undefined;

	// 派生状态
	assistants: AssistantStructure[];
	internalPrompt: InternalPrompt[];

	// 初始化方法
	init: () => () => void;
}

// 创建状态存储
export const useStateStore = create<IStateStore>()(
	subscribeWithSelector((set, get) => ({
		// 初始状态
		state: undefined,

		// 派生状态 - 初始值
		assistants: [],
		internalPrompt:[],

		// 初始化方法
		init: () => {
			// 消息处理函数
			const handleMessage = (message: ExtensionMessage) => {
				// 只处理 state 类型的消息
				if (message.type === 'state' && message.state) {
					const newState = message.state as unknown as SharedContext;
					// 更新状态
					set({
						state: { ...get().state, ...newState },
					});
				}
			};

			// 使用消息总线订阅扩展消息
			messageBus.on(BACKGROUND_MESSAGE, handleMessage as BackGroundMessageHandler);

			// 返回清理函数
			return () => {
				messageBus.off(BACKGROUND_MESSAGE, handleMessage as BackGroundMessageHandler);
			};
		},
	}))
);

// 设置派生状态监听器
createListeners<IStateStore>(
	[
		{
			target: [
				'assistants',
				'internalPrompt'
			],
			sources: 'state',
			compute: (current) => {
				return current.state;
			}
		}
	],
	useStateStore
);
