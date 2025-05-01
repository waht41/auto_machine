import { CoderCommand, IInternalContext } from '@core/internal-implementation/type';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { safeExec } from '@/utils/exec';

export async function handleCmdCommand(command: CoderCommand & { cmd: 'cmd' }, context: IInternalContext): Promise<string> {
	const { cline } = context;
	try {
		const { stdout, stderr } = await safeExec(command.content);

		if (stderr) {
			return `output ${stdout}, Command execution error: ${stderr}`;
		}
    
		return stdout || 'Command executed successfully, no output';
	} catch (error) {
		const errorMessage = `Command execution failed: ${error.message}`;
		await cline.sayP({ sayType: 'error', text: errorMessage, partial: false });
		return errorMessage;
	}
}

export async function handleNodeCommand(command: CoderCommand & { cmd: 'node' }, context: IInternalContext): Promise<string> {
	const { cline } = context;
  
	try {
		// 创建临时JS文件
		const tempFile = path.join(os.tmpdir(), `node_exec_${Date.now()}.js`);
		fs.writeFileSync(tempFile, command.content);
    
		// 执行临时JS文件
		const { stdout, stderr } = await safeExec(`node "${tempFile}"`);
    
		// 删除临时文件
		try {
			fs.unlinkSync(tempFile);
		} catch (e) {
			console.error(e);
		}
    
		if (stderr) {
			return `output ${stdout}, Node.js execution error: ${stderr}`;
		}
    
		return stdout || 'Node.js code executed successfully, no output';
	} catch (error) {
		const errorMessage = `Node.js code execution failed: ${error.message}`;
		await cline.sayP({ sayType: 'tool', text: errorMessage, partial: false });
		return errorMessage;
	}
}
