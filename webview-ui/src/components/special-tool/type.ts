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
    cmd?: string;
    askType?: string;
    action?: string;
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
    result?: string | string[];
}

export interface ApprovalTool extends BaseTool {
    type: 'ask';
    askType: 'askApproval';
    content: unknown;
}

export interface FollowupTool extends BaseTool {
    type: 'ask';
    askType: 'followup';
    question: string;
}

export interface SearchTool extends BaseTool {
    complete?: boolean;
}

export interface ShowTool extends BaseTool {
    path: string;
}

export interface BarTool extends BaseTool {
    bars: {x: number, y: number, label?: string}[];
}

export interface LineTool extends BaseTool {
    lines: {x: number, y: number, label?: string}[];
}

export interface PieTool extends BaseTool {
    pies: {name: string, value: number}[];
}

export type Tool = LogTool | ChoiceTool | ApprovalTool | FollowupTool | SearchTool | ShowTool | BarTool | LineTool | PieTool;
