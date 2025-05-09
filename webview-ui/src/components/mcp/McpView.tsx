import {
	VSCodeButton,
	VSCodeLink,
	VSCodePanels,
	VSCodePanelTab,
	VSCodePanelView,
} from '@vscode/webview-ui-toolkit/react';
import { useState } from 'react';
import { vscode } from '../../utils/vscode';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { McpServer } from '../../../../src/shared/mcp';
import McpToolRow from './McpToolRow';
import McpResourceRow from './McpResourceRow';
import { Switch } from 'antd';

type McpViewProps = {
	onDone: () => void
}

const McpView = ({ onDone }: McpViewProps) => {
	const { mcpServers: servers, alwaysAllowMcp, mcpEnabled } = useExtensionState();

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
			}}>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					padding: '10px 17px 10px 20px',
				}}>
				<h3 style={{ color: 'var(--vscode-foreground)', margin: 0 }}>MCP Servers</h3>
				<VSCodeButton onClick={onDone}>Done</VSCodeButton>
			</div>

			<div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
				<div
					style={{
						color: 'var(--vscode-foreground)',
						fontSize: '13px',
						marginBottom: '10px',
						marginTop: '5px',
					}}>
					The{' '}
					<VSCodeLink href="https://github.com/modelcontextprotocol" style={{ display: 'inline' }}>
						Model Context Protocol
					</VSCodeLink>{' '}
					enables communication with locally running MCP servers that provide additional tools and resources
					to extend Roo's capabilities. You can use{' '}
					<VSCodeLink href="https://github.com/modelcontextprotocol/servers" style={{ display: 'inline' }}>
						community-made servers
					</VSCodeLink>{' '}
					or ask Roo to create new tools specific to your workflow (e.g., "add a tool that gets the latest npm
					docs").
				</div>

				{/*<McpEnabledToggle />*/}

				{mcpEnabled && (
					<>
						{/* Server List */}
						{servers.length > 0 && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
								{servers.map((server) => (
									<ServerRow key={server.name} server={server} alwaysAllowMcp={alwaysAllowMcp} />
								))}
							</div>
						)}

						{/* Edit Settings Button */}
						<div style={{ marginTop: '10px', width: '100%' }}>
							<VSCodeButton
								appearance="secondary"
								style={{ width: '100%' }}
								onClick={() => {
									vscode.postMessage({ type: 'openMcpSettings' });
								}}>
								<span className="codicon codicon-edit" style={{ marginRight: '6px' }}></span>
								Edit MCP Settings
							</VSCodeButton>
						</div>
					</>
				)}

				{/* Bottom padding */}
				<div style={{ height: '20px' }} />
			</div>
		</div>
	);
};

// Server Row Component
const ServerRow = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [timeoutValue, setTimeoutValue] = useState(() => {
		const configTimeout = JSON.parse(server.config)?.timeout;
		return configTimeout ?? 60; // Default 1 minute (60 seconds)
	});

	const timeoutOptions = [
		{ value: 15, label: '15 seconds' },
		{ value: 30, label: '30 seconds' },
		{ value: 60, label: '1 minute' },
		{ value: 300, label: '5 minutes' },
		{ value: 600, label: '10 minutes' },
		{ value: 900, label: '15 minutes' },
		{ value: 1800, label: '30 minutes' },
		{ value: 3600, label: '60 minutes' },
	];

	const getStatusColor = () => {
		switch (server.status) {
			case 'connected':
				return 'var(--vscode-testing-iconPassed)';
			case 'connecting':
				return 'var(--vscode-charts-yellow)';
			case 'disconnected':
				return 'var(--vscode-testing-iconFailed)';
		}
	};

	const handleRowClick = () => {
		if (!server.error) {
			setIsExpanded(!isExpanded);
		}
	};

	const handleRestart = () => {
		vscode.postMessage({
			type: 'restartMcpServer',
			text: server.name,
		});
	};

	const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const seconds = parseInt(event.target.value);
		setTimeoutValue(seconds);
		vscode.postMessage({
			type: 'updateMcpTimeout',
			serverName: server.name,
			timeout: seconds,
		});
	};

	return (
		<div style={{ marginBottom: '10px' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					padding: '8px',
					background: 'var(--vscode-textCodeBlock-background)',
					cursor: server.error ? 'default' : 'pointer',
					borderRadius: isExpanded || server.error ? '4px 4px 0 0' : '4px',
					opacity: server.disabled ? 0.6 : 1,
				}}
				onClick={handleRowClick}>
				{!server.error && (
					<span
						className={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`}
						style={{ marginRight: '8px' }}
					/>
				)}
				<span style={{ flex: 1 }}>{server.name}</span>
				<div
					style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}
					onClick={(e) => e.stopPropagation()}>
					<Switch
						checked={!server.disabled}
						size="small"
						onClick={() => {
							vscode.postMessage({
								type: 'toggleMcpServer',
								serverName: server.name,
								disabled: !server.disabled,
							});
						}}
					/>
				</div>
				<div
					style={{
						width: '16px',
						height: '16px',
						borderRadius: '50%',
						background: getStatusColor(),
						marginLeft: '8px',
					}}
				/>
			</div>

			{server.error ? (
				<div
					style={{
						fontSize: '13px',
						background: 'var(--vscode-textCodeBlock-background)',
						borderRadius: '0 0 4px 4px',
						width: '100%',
					}}>
					<div
						style={{
							color: 'var(--vscode-testing-iconFailed)',
							marginBottom: '8px',
							padding: '0 10px',
							overflowWrap: 'break-word',
							wordBreak: 'break-word',
						}}>
						{server.error}
					</div>
					<VSCodeButton
						appearance="secondary"
						onClick={handleRestart}
						disabled={server.status === 'connecting'}
						style={{ width: 'calc(100% - 20px)', margin: '0 10px 10px 10px' }}>
						{server.status === 'connecting' ? 'Retrying...' : 'Retry Connection'}
					</VSCodeButton>
				</div>
			) : (
				isExpanded && (
					<div
						style={{
							background: 'var(--vscode-textCodeBlock-background)',
							padding: '0 10px 10px 10px',
							fontSize: '13px',
							borderRadius: '0 0 4px 4px',
						}}>
						<VSCodePanels style={{ marginBottom: '10px' }}>
							<VSCodePanelTab id="tools" style={{color:'black'}}>Tools ({server.tools?.length || 0})</VSCodePanelTab>
							<VSCodePanelTab id="resources" style={{color:'black'}}>
								Resources (
								{[...(server.resourceTemplates || []), ...(server.resources || [])].length || 0})
							</VSCodePanelTab>

							<VSCodePanelView id="tools-view">
								{server.tools && server.tools.length > 0 ? (
									<div
										style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
										{server.tools.map((tool) => (
											<McpToolRow
												key={tool.name}
												tool={tool}
												serverName={server.name}
												alwaysAllowMcp={alwaysAllowMcp}
											/>
										))}
									</div>
								) : (
									<div style={{ padding: '10px 0', color: 'var(--vscode-descriptionForeground)' }}>
										No tools found
									</div>
								)}
							</VSCodePanelView>

							<VSCodePanelView id="resources-view">
								{(server.resources && server.resources.length > 0) ||
								(server.resourceTemplates && server.resourceTemplates.length > 0) ? (
										<div
											style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
											{[...(server.resourceTemplates || []), ...(server.resources || [])].map(
												(item) => (
													<McpResourceRow
														key={'uriTemplate' in item ? item.uriTemplate : item.uri}
														item={item}
													/>
												),
											)}
										</div>
									) : (
										<div style={{ padding: '10px 0', color: 'var(--vscode-descriptionForeground)' }}>
										No resources found
										</div>
									)}
							</VSCodePanelView>
						</VSCodePanels>

						{/* Network Timeout */}
						<div style={{ padding: '10px 7px' }}>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									marginBottom: '8px',
								}}>
								<span>Network Timeout</span>
								<select
									value={timeoutValue}
									onChange={handleTimeoutChange}
									style={{
										flex: 1,
										padding: '4px',
										background: 'var(--vscode-dropdown-background)',
										color: 'var(--vscode-dropdown-foreground)',
										border: '1px solid var(--vscode-dropdown-border)',
										borderRadius: '2px',
										outline: 'none',
										cursor: 'pointer',
									}}>
									{timeoutOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
							<span
								style={{
									fontSize: '12px',
									color: 'var(--vscode-descriptionForeground)',
									display: 'block',
								}}>
								Maximum time to wait for server responses
							</span>
						</div>

						<VSCodeButton
							appearance="secondary"
							onClick={handleRestart}
							disabled={server.status === 'connecting'}
							style={{ width: 'calc(100% - 14px)', margin: '0 7px 3px 7px' }}>
							{server.status === 'connecting' ? 'Restarting...' : 'Restart Server'}
						</VSCodeButton>
					</div>
				)
			)}
		</div>
	);
};

export default McpView;
