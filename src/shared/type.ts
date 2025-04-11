export type ParallelProp = {
	clines: ClineIdentifier[];
}

export type ClineIdentifier = {task:string, id:string, status:ClineStatus};
export type ClineStatus = 'running' | 'error' | 'completed' | 'pending';