import { type Cline } from '@core/Cline';
import { McpHub } from '@operation/MCP';
import { DIContainer } from '@core/services/di';
import { ClineStatus } from '@/shared/type';
import { Memory, SearchOption } from '@core/services/type';
import {
	CreateOptions,
	DownloadOptions,
	EditOptions,
	ListOptions,
	ReadOptions,
	SearchOptions
} from '@operation/File/type';

export interface IInternalContext{
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

export type MCPCommand = { type: 'mcp' } & (
  {
    cmd: 'list';
  } |
  {
    cmd: 'list_tool';
    server: string;
  } |
  {
    cmd: 'call_tool';
    server: string;
    mcp_tool: string;
    arguments: any;
  }
  );
export type MemoryCommand = {
  type: 'advance',
  cmd: 'memory',
} & ({
  action: 'add',
} & Memory | { action: 'search' } & SearchOption)
type CompressCommand = {
  type: 'advance',
  cmd: 'compress',
  history_id: number[],
  summary: string;
}
export type ParallelCommand = {
  type: 'advance',
  cmd: 'parallel',
  sub_tasks: string[]
}
export type AdvanceCommand = MemoryCommand | CompressCommand | ParallelCommand;

export type CoderCommand = { type: 'coder' } & (
  {
    cmd: 'cmd';
    content: string;
  } |
  {
    cmd: 'node';
    content: string;
  }
);
export type FileCommand = { type: 'file' } & (
  {
    cmd: 'read';
  } & ReadOptions |
  {
    cmd: 'create';
  } & CreateOptions |
  {
    cmd: 'list';
  } & ListOptions |
  {
    cmd: 'search';
  } & SearchOptions |
  {
    cmd: 'edit';
  } & EditOptions |
  {
    cmd: 'download';
  } & DownloadOptions
  );