import React, { useMemo } from 'react';
import { DefaultComponentProps } from './types';
import { ClineApiReqInfo } from '@/shared/ExtensionMessage';
import { AssistantTitle, StatusText } from '@webview-ui/components/chat/ChatRow/Header';
import messageBus from '@webview-ui/store/messageBus';
import { AGENT_STREAM_JUMP, APP_MESSAGE } from '@webview-ui/store/const';
import styled from 'styled-components';
import { ApiStatus } from '@/shared/type';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';

// 使用styled-components定义样式组件
const HeaderContainer = styled.div<HeaderContainerProps>`
  display: flex;
  align-items: center;
  margin-bottom: ${props => (props.$hasError ? '10px' : '0')};
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
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

// 为HeaderContainer定义接口
interface HeaderContainerProps {
  $hasError?: boolean;
}

const ErrorMessage = styled.p`
  margin: 0 0 10px 0;
`;


const ArrowIcon = styled.span.attrs({ className: 'codicon codicon-arrow-right' })`
  font-size: 14px;
`;

/**
 * 渲染API请求组件
 */
export const ApiRequestComponent = ({ message, isInArray }: DefaultComponentProps) => {
	if (!isInArray) {
		return <AssistantTitle/>;
	}
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
	const determineStatus = (): ApiStatus => {
		if (apiReqCancelReason) {
			return apiReqCancelReason === 'user_cancelled'
				? 'cancelled'
				: 'error';
		}
		if (cost) return 'completed';
		if (apiRequestFailedMessage) return 'error';
		return 'running';
	};

	const currentStatus = determineStatus();
	const title = <StatusText status={currentStatus} title={message.title} />;
  
	const hasError = !!((cost == null && apiRequestFailedMessage) || apiReqStreamingFailedMessage);

	const setShowAgentStream = useChatViewStore(state => state.setShowAgentStream);

	// 处理跳转到AgentStream
	const handleJumpToAgentStream = (e: React.MouseEvent) => {
		e.stopPropagation(); // 防止触发展开/折叠

		messageBus.emit(APP_MESSAGE, {
			type: AGENT_STREAM_JUMP,
			id: message.relateStreamId
		});

		setShowAgentStream(true);
		// 使用messageBus发送跳转事件
	};

	return (
		<>
			<HeaderContainer $hasError={hasError}>
				{title}
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

		</>
	);
};
