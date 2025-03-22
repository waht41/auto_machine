import React from 'react';
import { ClineMessage } from '@/shared/ExtensionMessage';
import { DefaultComponent } from './DefaultComponent';
import { ReasoningComponent } from './ReasoningComponent';
import { ApiRequestComponent } from './ApiRequestComponent';
import { TextComponent } from './TextComponent';
import { UserFeedbackComponent } from './UserFeedbackComponent';
import { ErrorComponent } from './ErrorComponent';
import { CompletionResultComponent } from './CompletionResultComponent';
import { MistakeLimitReachedComponent } from './MistakeLimitReachedComponent';
import { FollowupComponent } from './FollowupComponent';
import { ComponentRenderer, DefaultComponentProps, RouteNode } from './types';

// 组件路由表 - 按照消息类型和子类型进行映射
const componentRoutes: RouteNode = {
	say: {
		reasoning: ReasoningComponent,
		api_req_started: ApiRequestComponent,
		text: TextComponent,
		user_feedback: UserFeedbackComponent,
		error: ErrorComponent,
		completion_result: CompletionResultComponent,
	},
	ask: {
		mistake_limit_reached: MistakeLimitReachedComponent,
		completion_result: CompletionResultComponent,
		followup: FollowupComponent,
	}
};

// 调试模式标志
const isDevMode = process.env.NODE_ENV === 'development';

/**
 * 解析组件 - 根据消息类型和子类型返回对应的组件
 * @param message 消息对象
 * @returns 对应的组件渲染器
 */
export const resolveComponent = (message: ClineMessage): ComponentRenderer => {
	if (!message || typeof message !== 'object') {
		console.error('[MessageRouter] 无效消息对象:', message);
		return DefaultComponent;
	}

	const type: string = message.type;

	// 调试输出
	if (isDevMode) {
		console.log(`[MessageRouter] 尝试解析组件: type=${type}, subType=${message.say || message.ask || '未知'}`);
	}

	// 检查类型是否存在
	if (!type || !componentRoutes[type]) {
		console.warn(`[MessageRouter] 未找到类型: ${type}`);
		return DefaultComponent;
	}

	// 获取子类型
	let subType  = '';
	if (type === 'say') {
		subType = message.say || '';
	} else if (type === 'ask') {
		subType = message.ask || '';
	}

	// 检查子类型是否存在
	if (!subType || !componentRoutes[type][subType]) {
		console.warn(`[MessageRouter] 未找到子类型: ${type}.${subType}`);
		return DefaultComponent;
	}

	// 获取组件
	const component = componentRoutes[type][subType];
  
	// 检查是否为组件渲染器
	if (typeof component !== 'function') {
		console.warn(`[MessageRouter] 组件不是渲染器: ${type}.${subType}`);
		return DefaultComponent;
	}

	// 调试输出
	if (isDevMode) {
		console.log(`[MessageRouter] 成功解析组件: ${type}.${subType}`);
	}

	// 返回匹配的组件
	return component as ComponentRenderer;
};


export function renderMessage(prop: DefaultComponentProps): React.ReactNode {
	// 解析组件
	const Component = resolveComponent(prop.message);
  
	// 渲染组件
	return <Component {...prop} />;
}
