export type GraphCommand = { type: 'coder' } & BarOption;


export type BarOption = {
	cmd: 'bar',
	bars: {x: number, y: number, label: string};
}