import { BaseCommandExecutor } from './base';
import { CommandRunner } from '@executors/runner';
import { AskCommandExecutor } from '@core/internal-implementation/ask';
import { BrowserCommandExecutor, ExternalCommandExecutor, FileCommandExecutor } from '@executors/implementations';
import { ApprovalCommandExecutor } from '@core/internal-implementation/approval';
import { MCPCommandExecutor } from '@core/internal-implementation/mcp';

export const registerInternalImplementation = (codeRunner: CommandRunner) => {
	codeRunner.registerExecutor('base', new BaseCommandExecutor());
	codeRunner.registerExecutor('ask', new AskCommandExecutor());
	codeRunner.registerExecutor('file', new FileCommandExecutor());
	codeRunner.registerExecutor('browser', new BrowserCommandExecutor());
	codeRunner.registerExecutor('external', new ExternalCommandExecutor());
	codeRunner.registerExecutor('approval', new ApprovalCommandExecutor());
	codeRunner.registerExecutor('MCP', new MCPCommandExecutor());
};
