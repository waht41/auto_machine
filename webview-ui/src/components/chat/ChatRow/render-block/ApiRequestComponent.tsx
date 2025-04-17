import React, { useMemo } from 'react';
import { VSCodeBadge } from '@vscode/webview-ui-toolkit/react';
import CodeAccordian from '@webview-ui/components/common/CodeAccordian';
import { DefaultComponentProps } from './types';
import { ClineApiReqInfo } from '@/shared/ExtensionMessage';
import { StatusIcon, StatusText, ChatStatus } from '@webview-ui/components/chat/ChatRow/Header';
import messageBus from '@webview-ui/store/messageBus';
import { AGENT_STREAM_JUMP, APP_MESSAGE } from '@webview-ui/store/const';
import styled from 'styled-components';

// 使用styled-components定义样式组件
const HeaderContainer = styled.div<HeaderContainerProps>`
  display: flex;
  align-items: center;
  font-weight: bold;
  margin-bottom: ${props => (props.$hasError ? '10px' : '0')};
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-grow: 1;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const JumpButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
  margin-right: 8px;
  
  &:hover {
    opacity: 1;
  }
`;

// 为StyledBadge定义接口
interface StyledBadgeProps {
  cost?: number;
}

const StyledBadge = styled(VSCodeBadge)<StyledBadgeProps>`
  opacity: ${props => (props.cost != null && props.cost > 0 ? 1 : 0)};
`;

// 为HeaderContainer定义接口
interface HeaderContainerProps {
  $hasError?: boolean;
}

const ErrorMessage = styled.p`
  margin: 0 0 10px 0;
`;

const ExpandedContent = styled.div`
  margin-top: 10px;
`;

const ArrowIcon = styled.span.attrs({ className: 'codicon codicon-arrow-right' })`
  font-size: 14px;
`;

// 为ChevronIcon定义接口
interface ChevronIconProps {
  $expanded: boolean;
}

const ChevronIcon = styled.span.attrs<ChevronIconProps>(props => ({
	className: `codicon codicon-chevron-${props.$expanded ? 'up' : 'down'}`
}))<ChevronIconProps>``;

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
	const apiRequestFailedMessage = undefined;
  
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
  
	const hasError = !!((cost == null && apiRequestFailedMessage) || apiReqStreamingFailedMessage);

	// 处理跳转到AgentStream
	const handleJumpToAgentStream = (e: React.MouseEvent) => {
		e.stopPropagation(); // 防止触发展开/折叠

		// 使用messageBus发送跳转事件
		messageBus.emit(APP_MESSAGE, {
			type: AGENT_STREAM_JUMP,
			id: message.relateStreamId
		});
	};

	return (
		<>
			<HeaderContainer $hasError={hasError} onClick={onToggleExpand}>
				<HeaderLeft>
					{icon}
					{title}
					<StyledBadge cost={cost}>
            ${Number(cost || 0)?.toFixed(4)}
					</StyledBadge>
					<ChevronIcon $expanded={isExpanded} />
				</HeaderLeft>
				{message.relateStreamId && <HeaderRight>
					<JumpButton
						onClick={handleJumpToAgentStream}
						title="jump to correspond agent stream"
					>
						<ArrowIcon />
					</JumpButton>

				</HeaderRight>}
			</HeaderContainer>
			{hasError && (
				<>
					<ErrorMessage>
						{apiRequestFailedMessage || apiReqStreamingFailedMessage}
					</ErrorMessage>
				</>
			)}

			{isExpanded && (
				<ExpandedContent>
					<CodeAccordian
						code={JSON.parse(message.text || '{}').request}
						language="markdown"
						isExpanded={true}
						onToggleExpand={onToggleExpand}
					/>
				</ExpandedContent>
			)}
		</>
	);
};
