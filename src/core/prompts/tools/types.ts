import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "@operation/mcp"

export type ToolArgs = {
	cwd: string
	supportsComputerUse: boolean
	diffStrategy?: DiffStrategy
	browserViewportSize?: string
	mcpHub?: McpHub
	toolOptions?: any
}
