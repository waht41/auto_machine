import React from 'react';
import { ChatRowContentProps } from '@webview-ui/components/chat/ChatRow/ChatRow';
import { ClineAsk, ClineSay } from '@/shared/ExtensionMessage';

// 基础组件渲染器类型
export type ComponentRenderer = (props: DefaultComponentProps) => React.ReactNode;

export type RouteNode = {
  [K in 'ask' | 'say']: K extends 'ask'
    ? { [Key in ClineAsk]?: ComponentRenderer }    // 限制 ask 下只能有 ClineAsk 的键
    : { [Key in ClineSay]?: ComponentRenderer };   // 限制 say 下只能有 ClineSay 的键
};
// 默认组件属性
export type DefaultComponentProps = ChatRowContentProps
