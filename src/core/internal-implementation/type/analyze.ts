import { GatherOptions, PreviewOptions } from '@operation/Analyze/type';

export type GatherCommand = {
	type: 'analyze',
	cmd: 'gather',
} & GatherOptions;

export type PreviewCommand = {
	type: 'analyze',
	cmd: 'preview'
} & PreviewOptions;

export type AnalyzeCommand = GatherCommand | PreviewCommand;


