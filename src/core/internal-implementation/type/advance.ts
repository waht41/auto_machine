import { Memory, SearchOption } from '@core/services/type';

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
