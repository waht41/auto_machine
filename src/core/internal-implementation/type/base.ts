import { ClineStatus } from '@/shared/type';
import { Cline } from '@core/Cline';
import { DIContainer } from '@core/services/di';
import { McpHub } from '@operation/MCP';

export interface IInternalContext {
    cline: Cline;
    di: DIContainer;
    mcpHub?: McpHub
    replacing?: boolean;
    approval?: boolean;
}

export type IBaseCommand = {type:'base'} & ({
    cmd: 'log';
    title: string;
    content: string;
} | {
    cmd: 'think'; //某些思考模型自带的，模型不会主动调用
    content: string;
} | PlanCommand | ChildNodeCommand)

export type PlanCommand = {cmd:'plan'} & ({
  action: 'start';
  content: string[];
}| {
  action: 'adjust';
  reason: string;
  content: string[];
  currentStep: number;
} | {
  action: 'complete_step';
  nextStep?: number;
})

export type ChildNodeCommand = {
  cmd: 'complete_parallel_node';
  message: string;
  status: ClineStatus;
}

export type IAskCommand = {type:'ask'; uuid: string, result?: string} & ({
    askType: 'followup';
    question: string;
} | {
    askType: 'choice';
    question: string;
    choices: string[];
} | {
    askType: 'multiple_choice';
    question: string;
    choices: string[];
} | {
    askType: 'attempt_completion';
    question: string;
})

export type IAskApprovalCommand = {
    type: 'askApproval';
    content: any;
}

export type IApprovalCommand = {
    type: 'approval';
    content: any;
}
