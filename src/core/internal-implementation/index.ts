import { BaseCommandExecutor } from './base';
import { CommandRunner } from '@executors/runner';
import { AskCommandExecutor } from '@core/internal-implementation/ask';
import { ApprovalCommandExecutor } from '@core/internal-implementation/approval';
import { MCPCommandExecutor } from '@core/internal-implementation/mcp';
import { FileCommandExecutor } from '@core/internal-implementation/file';
import { BrowserCommandExecutor } from '@core/internal-implementation/browser';
import { ExternalCommandExecutor } from '@core/internal-implementation/external';
import { AdvanceExecutor } from '@core/internal-implementation/advance';
import { CoderCommandExecutor } from '@core/internal-implementation/coder';
import { AnalyzeCommandExecutor } from '@core/internal-implementation/analyze';

export const registerInternalImplementation = (codeRunner: CommandRunner) => {
	codeRunner.registerExecutor('base', new BaseCommandExecutor());
	codeRunner.registerExecutor('ask', new AskCommandExecutor());
	codeRunner.registerExecutor('file', new FileCommandExecutor());
	codeRunner.registerExecutor('browser', new BrowserCommandExecutor());
	codeRunner.registerExecutor('external', new ExternalCommandExecutor());
	codeRunner.registerExecutor('approval', new ApprovalCommandExecutor());
	codeRunner.registerExecutor('MCP', new MCPCommandExecutor());
	codeRunner.registerExecutor('advance', new AdvanceExecutor());
	codeRunner.registerExecutor('coder', new CoderCommandExecutor());
	codeRunner.registerExecutor('analyze', new AnalyzeCommandExecutor());
};
