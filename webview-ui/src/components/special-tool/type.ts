// 组件类型定义
import React from 'react';

export type ComponentRenderer = (prop: any) => React.ReactNode;

interface RouteNodeMap {
    [key: string]: RouteNode;
}

export type RouteNode = ComponentRenderer | RouteNodeMap;

// 定义工具类型接口
export interface BaseTool {
    type: string;
    uuid: string;

    [key: string]: any;
}

export interface LogTool extends BaseTool {
    type: 'base';
    cmd: 'log';
    title: string;
    content: string;
}

export interface ChoiceTool extends BaseTool {
    type: 'ask';
    askType: 'choice';
    question: string;
    choices: string[];
    result?: string;
}

export interface ApprovalTool extends BaseTool {
    type: 'ask';
    askType: 'askApproval';
    content: any;
}

export type Tool = LogTool | ChoiceTool | ApprovalTool;
