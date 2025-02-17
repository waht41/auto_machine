export type AssistantMessageContent = TextContent | ToolUse

export interface TextContent {
	type: "text"
	content: string
	partial: boolean
}

export const toolUseNames = [
	"base",
	"ask",
	"external",
	"file"
] as const

// Converts array of tool call names into a union type ("execute_command" | "read_file" | ...)
export type ToolUseName = (typeof toolUseNames)[number]

export interface ToolUse {
	type: "tool_use"
	name: ToolUseName
	params: Record<string, any>
	partial: boolean
}
