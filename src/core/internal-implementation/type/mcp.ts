export type MCPCommand = { type: 'mcp' } & (
  {
    cmd: 'list';
  } |
  {
    cmd: 'list_tool';
    server: string;
  } |
  {
    cmd: 'call_tool';
    server: string;
    mcp_tool: string;
    arguments: any;
  }
);
