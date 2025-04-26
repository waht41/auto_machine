import React from 'react';
import { DefaultComponent } from './DefaultComponent';
import { ChoiceComponent, MultiChoiceComponent } from './ChoiceComponent';
import { headerStyle, toolIcon } from './common';
import { LogComponent } from './LogComponent';
import { BaseTool, ComponentRenderer, RouteNode } from './type';
import { AskApprovalComponent } from './AskApproval';
import { FollowupComponent } from '@webview-ui/components/special-tool/FollowupComponent';
import { DownloadComponent } from '@webview-ui/components/special-tool/DownloadComponent';
import { ParallelComponent } from '@webview-ui/components/special-tool/ParallelComponent';
import { SearchComponent } from '@webview-ui/components/special-tool/SearchComponent';
import { ShowInFolderComponent } from '@webview-ui/components/special-tool/ShowInFolder';
import { BarComponent } from '@webview-ui/components/special-tool/BarComponent';
import { LineComponent } from '@webview-ui/components/special-tool/LineComponent';
import { PieComponent } from '@webview-ui/components/special-tool/PieComponent';

const componentRoutes: Record<string, RouteNode> = {
	base: {
		log: LogComponent,
		showInFolder: ShowInFolderComponent,
	},
	ask: {
		choice: ChoiceComponent,
		multiple_choice: MultiChoiceComponent,
		askApproval: AskApprovalComponent,
		followup: FollowupComponent,
	},
	file: {
		download: DownloadComponent,
	},
	browser: {
		download: DownloadComponent,
		search: SearchComponent,
	},
	advance: {
		parallel: ParallelComponent,
	},
	graph: {
		bar: BarComponent,
		line: LineComponent,
		pie: PieComponent,
	}
};

// 类型映射表 - 用于确定如何从工具对象中获取子类型
// 支持无限层级，数组中的字段按优先级排序
const TYPE_PRIORITY = ['type', 'cmd', 'askType', 'action'];

// 调试工具 - 仅在开发环境中启用
const isDevMode = process.env.NODE_ENV === 'development';

// 路由解析引擎
export const resolveComponent = (tool: BaseTool): ComponentRenderer => {
	if (!tool || typeof tool !== 'object') {
		console.error('[ComponentRouter] 无效工具对象:', tool);
		return DefaultComponent;
	}

	const {type} = tool;

	// 调试输出
	if (isDevMode) {
		console.log(`[ComponentRouter] 尝试解析组件: type=${type}, subType=${tool.cmd || tool.askType || '未知'}`);
	}

	// 第一级：检查类型是否存在
	if (!type || !componentRoutes[type]) {
		console.warn(`[ComponentRouter] 未找到类型: ${type}`);
		return DefaultComponent;
	}

	// 获取路由路径
	const routePath = [];

	// 遍历所有可能的子类型字段，按优先级尝试获取
	for (const field of TYPE_PRIORITY) {
		if (tool[field]) {
			routePath.push(tool[field]);
		}
	}

	// 如果没有找到任何子类型
	if (routePath.length <= 1) {
		console.warn(`[ComponentRouter] 未找到任何子类型: ${type}`);
		return DefaultComponent;
	}

	// 根据路径查找组件
	let currentRoute: RouteNode = componentRoutes;
	for (let i = 0; i < routePath.length; i++) {
		const segment = routePath[i] as string;
		if (!currentRoute || typeof currentRoute === 'function' || !currentRoute[segment]) {
			console.warn(`[ComponentRouter] 路由路径不存在: ${routePath.slice(0, i + 1).join('/')}`);
			return DefaultComponent;
		}
		currentRoute = currentRoute[segment];
	}

	// 检查最终节点是否为组件渲染器
	if (typeof currentRoute !== 'function') {
		console.warn(`[ComponentRouter] 路径终点不是组件渲染器: ${routePath.join('/')}`);
		return DefaultComponent;
	}

	// 调试输出
	if (isDevMode) {
		console.log(`[ComponentRouter] 成功解析组件: ${routePath.join('/')}`);
	}

	// 返回匹配的组件
	return currentRoute as ComponentRenderer;
};

/**
 * 注册新的工具组件
 * @param paths 路径，使用 / 分隔
 * @param renderer 组件渲染器
 */
export function registerToolComponent(
	paths: string,
	renderer: ComponentRenderer,
): void {
	const pathList = paths.split('/');
	let currentRoute: any = componentRoutes;
	let lastSegment: string | null = null;
	let lastObj: Record<string, RouteNode> | null = null;

	for (let i = 0; i < pathList.length - 1; i++) {
		const segment = pathList[i];
		if (!currentRoute[segment]) {
			currentRoute[segment] = {};
		}
		if (typeof currentRoute[segment] === 'function') {
			// 如果当前节点是一个渲染器函数，则替换为对象
			currentRoute[segment] = {};
		}
		lastObj = currentRoute;
		lastSegment = segment;
		currentRoute = currentRoute[segment] as Record<string, RouteNode>;
	}

	// 设置最后一个路径段的渲染器
	const finalSegment = pathList[pathList.length - 1];
	if (lastObj && lastSegment && pathList.length === 1) {
		componentRoutes[finalSegment] = renderer;
	} else if (currentRoute) {
		currentRoute[finalSegment] = renderer;
	}
}

// 主渲染函数
export const ToolComponent = (tool: BaseTool): React.ReactNode => {
	// 调试输出
	if (isDevMode) {
		console.log('[ComponentRouter] 开始渲染工具:', tool);
	}

	const Component = resolveComponent(tool);
	try {
		return <Component {...tool} />;
	} catch (error) {
		console.error('[ComponentRouter] 渲染组件出错:', error);
		// 在开发模式下显示更详细的错误信息
		if (isDevMode) {
			return (
				<div style={{...headerStyle, color: 'red', border: '1px solid red', padding: '10px'}}>
					{toolIcon('error')}
					<div>
						<h3>组件渲染错误</h3>
						<pre>{error instanceof Error ? error.stack : String(error)}</pre>
						<h4>工具数据:</h4>
						<pre>{JSON.stringify(tool, null, 2)}</pre>
					</div>
				</div>
			);
		}
		return <DefaultComponent {...tool} />;
	}
};