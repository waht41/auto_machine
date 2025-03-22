import { VSCodeBadge, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import deepEqual from 'fast-deep-equal';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSize } from 'react-use';
import { ClineApiReqInfo, ClineAskUseMcpServer, ClineMessage, ClineSayTool } from '@/shared/ExtensionMessage';
import { useExtensionState } from '../../../context/ExtensionStateContext';
import { findMatchingResourceOrTemplate } from '../../../utils/mcp';
import { vscode } from '../../../utils/vscode';
import CodeAccordian from '../../common/CodeAccordian';
import ReasoningBlock from '../ReasoningBlock';
import Thumbnails from '../../common/Thumbnails';
import McpResourceRow from '../../mcp/McpResourceRow';
import McpToolRow from '../../mcp/McpToolRow';
import { highlightMentions } from '../TaskHeader';
import renderSpecialTool from '../../special-tool';
import { Tool } from '../../special-tool/type';
import { errorColor, headerStyle, normalColor, pStyle, successColor } from '../../common/styles';
import { ChatStatus, StatusIcon, StatusText } from '@webview-ui/components/chat/ChatRow/Header';
import { Markdown } from '@webview-ui/components/chat/ChatRow/MarkdownBlock';
import { ProgressIndicator } from '@webview-ui/components/chat/ChatRow/ProgressIndicator';

interface ChatRowProps {
	message: ClineMessage
	isExpanded: boolean
	onToggleExpand: () => void
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
}

type ChatRowContentProps = Omit<ChatRowProps, 'onHeightChange'>

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props;
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0);

		const [chatrow, { height }] = useSize(
			<div
				style={{
					padding: '10px 6px 10px 15px',
				}}>
				<ChatRowContent {...props} />
			</div>,
		);

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0; // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current);
				}
				prevHeightRef.current = height;
			}
		}, [height, isLast, onHeightChange, message]);

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow;
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
);

export default ChatRow;

export const ChatRowContent = ({
	message,
	isExpanded,
	onToggleExpand,
	lastModifiedMessage,
	isLast,
	isStreaming,
}: ChatRowContentProps) => {
	const { mcpServers, alwaysAllowMcp } = useExtensionState();
	const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

	// Auto-collapse reasoning when new messages arrive
	useEffect(() => {
		if (!isLast && message.say === 'reasoning') {
			setReasoningCollapsed(true);
		}
	}, [isLast, message.say]);
	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text != null && message.say === 'api_req_started') {
			const info: ClineApiReqInfo = JSON.parse(message.text);
			return [info.cost, info.cancelReason, info.streamingFailedMessage];
		}
		return [undefined, undefined, undefined];
	}, [message.text, message.say]);
	// when resuming task, last wont be api_req_failed but a resume_task message, so api_req_started will show loading spinner. that's why we just remove the last api_req_started that failed without streaming anything
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === 'api_req_failed' // if request is retried then the latest message is a api_req_retried
			? lastModifiedMessage?.text
			: undefined;
	const isCommandExecuting = false;

	const isMcpServerResponding = false;

	const type = message.type === 'ask' ? message.ask : message.say;

	const [icon, title] = useMemo(() => {
		switch (type) {
			case 'error':
				return [
					<span
						className="codicon codicon-error"
						style={{ color: errorColor, marginBottom: '-1.5px' }}></span>,
					<span style={{ color: errorColor, fontWeight: 'bold' }}>Error</span>,
				];
			case 'mistake_limit_reached':
				return [
					<span
						className="codicon codicon-error"
						style={{ color: errorColor, marginBottom: '-1.5px' }}></span>,
					<span style={{ color: errorColor, fontWeight: 'bold' }}>Roo is having trouble...</span>,
				];
			case 'command':
				return [
					isCommandExecuting ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-terminal"
							style={{ color: normalColor, marginBottom: '-1.5px' }}></span>
					),
					<span style={{ color: normalColor, fontWeight: 'bold' }}>Roo wants to execute this command:</span>,
				];
			case 'use_mcp_server':
				const mcpServerUse = JSON.parse(message.text || '{}') as ClineAskUseMcpServer;
				return [
					isMcpServerResponding ? (
						<ProgressIndicator />
					) : (
						<span
							className="codicon codicon-server"
							style={{ color: normalColor, marginBottom: '-1.5px' }}></span>
					),
					<span style={{ color: normalColor, fontWeight: 'bold' }}>
						Roo wants to {mcpServerUse.type === 'use_mcp_tool' ? 'use a tool' : 'access a resource'} on the{' '}
						<code>{mcpServerUse.serverName}</code> MCP server:
					</span>,
				];
			case 'completion_result':
				return [
					<span
						className="codicon codicon-check"
						style={{ color: successColor, marginBottom: '-1.5px' }}></span>,
					<span style={{ color: successColor, fontWeight: 'bold' }}>Task Completed</span>,
				];
			case 'api_req_started': {
				// 根据条件确定当前状态
				const determineStatus = (): ChatStatus => {
					if (apiReqCancelReason) {
						return apiReqCancelReason === 'user_cancelled'
							? 'CANCELLED'
							: 'STREAMING_FAILED';
					}
					if (cost) return 'SUCCESS';
					if (apiRequestFailedMessage) return 'FAILED';
					return 'IN_PROGRESS';
				};

				const currentStatus = determineStatus();
				return [
					<StatusIcon key="icon" status={currentStatus} />,
					<StatusText key="text" status={currentStatus} />,
				];
			}
			case 'followup':
				return [
					<span
						className="codicon codicon-question"
						style={{ color: normalColor, marginBottom: '-1.5px' }}></span>,
					<span style={{ color: normalColor, fontWeight: 'bold' }}>Roo has a question:</span>,
				];
			default:
				return [null, null];
		}
	}, [type, isCommandExecuting, message, isMcpServerResponding, apiReqCancelReason, cost, apiRequestFailedMessage]);

	const tool = useMemo(() => {
		if (message.ask === 'tool' || message.say === 'tool') {
			return JSON.parse(message.text || '{}') as ClineSayTool;
		}
		return null;
	}, [message.ask, message.say, message.text]);

	if (tool) {
		return renderSpecialTool(tool as unknown as Tool);
	}

	switch (message.type) {
		case 'say':
			switch (message.say) {
				case 'reasoning':
					return (
						<ReasoningBlock
							content={message.text || ''}
							isCollapsed={reasoningCollapsed}
							onToggleCollapse={() => setReasoningCollapsed(!reasoningCollapsed)}
						/>
					);
				case 'api_req_started':
					return (
						<>
							<div
								style={{
									...headerStyle,
									marginBottom:
										(cost == null && apiRequestFailedMessage) || apiReqStreamingFailedMessage
											? 10
											: 0,
									justifyContent: 'space-between',
									cursor: 'pointer',
									userSelect: 'none',
									WebkitUserSelect: 'none',
									MozUserSelect: 'none',
									msUserSelect: 'none',
								}}
								onClick={onToggleExpand}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
									{icon}
									{title}
									<VSCodeBadge style={{ opacity: cost != null && cost > 0 ? 1 : 0 }}>
										${Number(cost || 0)?.toFixed(4)}
									</VSCodeBadge>
								</div>
								<span className={`codicon codicon-chevron-${isExpanded ? 'up' : 'down'}`}></span>
							</div>
							{((cost == null && apiRequestFailedMessage) || apiReqStreamingFailedMessage) && (
								<>
									<p style={{ ...pStyle, color: 'var(--vscode-errorForeground)' }}>
										{apiRequestFailedMessage || apiReqStreamingFailedMessage}
										{apiRequestFailedMessage?.toLowerCase().includes('powershell') && (
											<>
												<br />
												<br />
												It seems like you're having Windows PowerShell issues, please see this{' '}
												<a
													href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
													style={{ color: 'inherit', textDecoration: 'underline' }}>
													troubleshooting guide
												</a>
												.
											</>
										)}
									</p>

									{/* {apiProvider === "" && (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													backgroundColor:
														"color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)",
													color: "var(--vscode-editor-foreground)",
													padding: "6px 8px",
													borderRadius: "3px",
													margin: "10px 0 0 0",
													fontSize: "12px",
												}}>
												<i
													className="codicon codicon-warning"
													style={{
														marginRight: 6,
														fontSize: 16,
														color: "var(--vscode-errorForeground)",
													}}></i>
												<span>
													Uh-oh, this could be a problem on end. We've been alerted and
													will resolve this ASAP. You can also{" "}
													<a
														href=""
														style={{ color: "inherit", textDecoration: "underline" }}>
														contact us
													</a>
													.
												</span>
											</div>
										)} */}
								</>
							)}

							{isExpanded && (
								<div style={{ marginTop: '10px' }}>
									<CodeAccordian
										code={JSON.parse(message.text || '{}').request}
										language="markdown"
										isExpanded={true}
										onToggleExpand={onToggleExpand}
									/>
								</div>
							)}
						</>
					);
				case 'text':
					return (
						<div>
							<Markdown markdown={message.text} partial={message.partial} />
						</div>
					);
				case 'user_feedback':
					return (
						<div
							style={{
								backgroundColor: 'var(--vscode-badge-background)',
								color: 'var(--vscode-badge-foreground)',
								borderRadius: '3px',
								padding: '9px',
								whiteSpace: 'pre-line',
								wordWrap: 'break-word',
							}}>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'flex-start',
									gap: '10px',
								}}>
								<span style={{ display: 'block', flexGrow: 1, padding: '4px' }}>
									{highlightMentions(message.text)}
								</span>
								<VSCodeButton
									appearance="icon"
									style={{
										padding: '3px',
										flexShrink: 0,
										height: '24px',
										marginTop: '-3px',
										marginBottom: '-3px',
										marginRight: '-6px',
									}}
									disabled={isStreaming}
									onClick={(e) => {
										e.stopPropagation();
										vscode.postMessage({
											type: 'deleteMessage',
											value: message.ts,
										});
									}}>
									<span className="codicon codicon-trash"></span>
								</VSCodeButton>
							</div>
							{message.images && message.images.length > 0 && (
								<Thumbnails images={message.images} style={{ marginTop: '8px' }} />
							)}
						</div>
					);
				case 'error':
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<p style={{ ...pStyle, color: 'var(--vscode-errorForeground)' }}>{message.text}</p>
						</>
					);
				case 'completion_result':
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<div style={{ color: 'var(--vscode-charts-green)', paddingTop: 10 }}>
								<Markdown markdown={message.text} />
							</div>
						</>
					);
				default:
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 10 }}>
								<Markdown markdown={message.text} partial={message.partial} />
							</div>
						</>
					);
			}
		case 'ask':
			switch (message.ask) {
				case 'mistake_limit_reached':
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<p style={{ ...pStyle, color: 'var(--vscode-errorForeground)' }}>{message.text}</p>
						</>
					);
				case 'use_mcp_server':
					const useMcpServer = JSON.parse(message.text || '{}') as ClineAskUseMcpServer;
					const server = mcpServers.find((server) => server.name === useMcpServer.serverName);
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>

							<div
								style={{
									background: 'var(--vscode-textCodeBlock-background)',
									borderRadius: '3px',
									padding: '8px 10px',
									marginTop: '8px',
								}}>
								{useMcpServer.type === 'access_mcp_resource' && (
									<McpResourceRow
										item={{
											// Use the matched resource/template details, with fallbacks
											...(findMatchingResourceOrTemplate(
												useMcpServer.uri || '',
												server?.resources,
												server?.resourceTemplates,
											) || {
												name: '',
												mimeType: '',
												description: '',
											}),
											// Always use the actual URI from the request
											uri: useMcpServer.uri || '',
										}}
									/>
								)}

								{useMcpServer.type === 'use_mcp_tool' && (
									<>
										<div onClick={(e) => e.stopPropagation()}>
											<McpToolRow
												tool={{
													name: useMcpServer.toolName || '',
													description:
														server?.tools?.find(
															(tool) => tool.name === useMcpServer.toolName,
														)?.description || '',
													alwaysAllow:
														server?.tools?.find(
															(tool) => tool.name === useMcpServer.toolName,
														)?.alwaysAllow || false,
												}}
												serverName={useMcpServer.serverName}
												alwaysAllowMcp={alwaysAllowMcp}
											/>
										</div>
										{useMcpServer.arguments && useMcpServer.arguments !== '{}' && (
											<div style={{ marginTop: '8px' }}>
												<div
													style={{
														marginBottom: '4px',
														opacity: 0.8,
														fontSize: '12px',
														textTransform: 'uppercase',
													}}>
													Arguments
												</div>
												<CodeAccordian
													code={useMcpServer.arguments}
													language="json"
													isExpanded={true}
													onToggleExpand={onToggleExpand}
												/>
											</div>
										)}
									</>
								)}
							</div>
						</>
					);
				case 'completion_result':
					if (message.text) {
						return (
							<div>
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
								<div style={{ color: 'var(--vscode-charts-green)', paddingTop: 10 }}>
									<Markdown markdown={message.text} partial={message.partial} />
								</div>
							</div>
						);
					} else {
						return null; // Don't render anything when we get a completion_result ask without text
					}
				case 'followup':
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 10 }}>
								<Markdown markdown={message.text} />
							</div>
						</>
					);
				default:
					return null;
			}
	}
};