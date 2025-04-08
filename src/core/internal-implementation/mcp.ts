import { CommandExecutor } from '@executors/types';
import yaml from 'js-yaml';
import { IInternalContext, MCPCommand } from '@core/internal-implementation/type';
import pWaitFor from 'p-wait-for';

export class MCPCommandExecutor implements CommandExecutor {
	async execute(command: MCPCommand, context: IInternalContext): Promise<any> {
		const mcp = context.mcpHub;
		if (!mcp){
			return 'MCP not defined';
		}
		await pWaitFor(() => !mcp!.isConnecting, {timeout: 10_000}).catch(() => {
			console.error('MCP servers failed to connect in time');
		});
		switch (command.cmd) {
			case 'list':
				return yaml.dump(mcp.getServers());
			case 'list_tool':
				return yaml.dump(await mcp.fetchToolsList(command.server));
			case 'call_tool':
				const res = await mcp.callTool(command.server, command.mcp_tool, command.arguments);
				return yaml.dump(res);
			default:
				throw new Error(`Unknown action: ${command}`);
		}
	}
}

