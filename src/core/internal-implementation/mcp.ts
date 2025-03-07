import { CommandExecutor } from "@executors/types";
import { McpHub } from "@operation/MCP";
import yaml from "js-yaml";
import { MCPCommand } from "@core/internal-implementation/type";

let mcp: McpHub = new McpHub('.', async () => {});

let initialize = false;

export class MCPCommandExecutor implements CommandExecutor {
  async execute(command: MCPCommand, context: any): Promise<any> {
    if (!initialize){
      await mcp.initialize()
    }
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

