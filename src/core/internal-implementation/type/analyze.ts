import { GatherOptions } from '@operation/Analyze/type';

export type GatherCommand = {
	type: 'analyze',
	cmd: 'gather',
} & GatherOptions;

export type AnalyzeCommand = GatherCommand;


