import React from 'react';
import { ChatRowContentProps } from '@webview-ui/components/chat/ChatRow/ChatRow';

// 基础组件渲染器类型
export type ComponentRenderer = (props: DefaultComponentProps) => React.ReactNode;

export type RouteNode = {
  [key: string] : {[key: string] : ComponentRenderer};
};

// 默认组件属性
export type DefaultComponentProps = ChatRowContentProps
