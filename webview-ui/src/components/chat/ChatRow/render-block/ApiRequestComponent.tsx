import React, { useMemo } from 'react';
import { VSCodeBadge } from '@vscode/webview-ui-toolkit/react';
import CodeAccordian from '@webview-ui/components/common/CodeAccordian';
import { DefaultComponentProps } from './types';
import { ClineApiReqInfo } from '@/shared/ExtensionMessage';
import { StatusIcon, StatusText, ChatStatus } from '@webview-ui/components/chat/ChatRow/Header';

/**
 * 渲染API请求组件
 */
export const ApiRequestComponent = ({ message, isExpanded, onToggleExpand }: DefaultComponentProps) => {
	// 从消息中提取API请求信息
	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text != null && message.say === 'api_req_started') {
			const info: ClineApiReqInfo = JSON.parse(message.text);
			return [info.cost, info.cancelReason, info.streamingFailedMessage];
		}
		return [undefined, undefined, undefined];
	}, [message.text, message.say]);

	// if request is retried then the latest message is a api_req_retried
	const apiRequestFailedMessage = message?.ask === 'api_req_failed' ? message?.text : undefined;
  
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
	const icon = <StatusIcon status={currentStatus} />;
	const title = <StatusText status={currentStatus} />;

	return (
		<>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					fontWeight: 'bold',
					marginBottom: (cost == null && apiRequestFailedMessage) || apiReqStreamingFailedMessage ? 10 : 0,
					justifyContent: 'space-between',
					cursor: 'pointer',
					userSelect: 'none',
					WebkitUserSelect: 'none',
					MozUserSelect: 'none',
					msUserSelect: 'none',
				}}>
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
					<p style={{ 
						margin: '0 0 10px 0', 
						color: 'var(--vscode-errorForeground)' 
					}}>
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
};
