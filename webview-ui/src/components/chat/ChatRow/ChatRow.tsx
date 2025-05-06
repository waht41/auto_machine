import deepEqual from 'fast-deep-equal';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSize } from 'react-use';
import { ClineMessage, ClineSayTool } from '@/shared/ExtensionMessage';
import { ToolComponent } from '../../special-tool';
import { Tool } from '../../special-tool/type';
import { MessageComponent } from '@webview-ui/components/chat/ChatRow/render-block/router';
import { ShowedMessage } from '@webview-ui/components/chat/type';
import { Timeline } from 'antd';
import { AssistantTitle } from '@webview-ui/components/chat/ChatRow/Header';
import { colors } from '../../common/styles';
import { ReactComponent as GerySuccessIcon } from '@webview-ui/assets/greySuccessIcon.svg';
import { ReactComponent as ErrorIcon } from '@webview-ui/assets/errorIcon.svg';
import SVGComponent from '@webview-ui/components/common/SVGComponent';
import styled from 'styled-components';

// 自定义Timeline组件，将连接线改为0.5pt粗的虚线
const StyledTimeline = styled(Timeline)`
  .ant-timeline-item-tail {
    border-left: 0.5pt dashed ${colors.borderDivider};
  }
  
  .ant-timeline-item-head {
    background: transparent;
  }

  /* 覆盖 Ant Design 的默认字体设置，使用继承的字体 */
  &.ant-timeline,
  .ant-timeline-item-content,
  .ant-timeline * {
    font-family: inherit;
  }
`;

interface ChatRowProps {
  message: ShowedMessage;
  isLast: boolean
  onHeightChange: (isTaller: boolean) => void
  isStreaming: boolean
}

export type ChatRowContentProps = Omit<ChatRowProps, 'onHeightChange'>

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange } = props;
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0);


		const [chatrow, { height }] = useSize(
			<div
				style={{
					padding: '10px 6px 10px 15px',
				}}>
				<ChatRowContent {...props}  />
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
		}, [height, isLast, onHeightChange]);

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow;
	},
	// 使用自定义比较函数，只比较必要的属性
	(prevProps, nextProps) => {
		// 只有这些属性变化时才重新渲染
		return (
			prevProps.isLast === nextProps.isLast &&
      prevProps.isStreaming === nextProps.isStreaming &&
      deepEqual(prevProps.message, nextProps.message)
		);
	}
);

export default ChatRow;

// 创建一个智能容器，根据子元素的 margin-left 自动调整自身的 margin-left
const MessageContainer = styled.div<{ $childMargin?: number, $childMarginTop?: number }>`
  margin-top: ${props => Math.max(0, 20 - (props.$childMarginTop || 0))}px;
  margin-left: ${props => Math.max(0, 0 - (props.$childMargin || 0))}px;
`;

// 获取组件的计算样式中的 margin-left 值
const getComputedMarginLeft = (element: HTMLElement | null): number => {
	if (!element) return 0;
	const computedStyle = window.getComputedStyle(element);
	return parseInt(computedStyle.marginLeft || '0', 10);
};

// 获取组件的计算样式中的 margin-top 值
const getComputedMarginTop = (element: HTMLElement | null): number => {
	if (!element) return 0;
	const computedStyle = window.getComputedStyle(element);
	return parseInt(computedStyle.marginTop || '0', 10);
};

// 渲染消息数组的函数
const MessageArray = ({ messages, props }: { messages: ClineMessage[], props: ChatRowContentProps }) => {
	// 筛选出 api_req_started 类型的消息作为 Timeline 的项
	const apiReqStartedMessages = messages.filter(msg => msg.say === 'api_req_started');
  
	// 如果没有 api_req_started 消息，则使用普通方式渲染所有消息
	if (apiReqStartedMessages.length === 0) {
		const items = messages.map((msg) => ({
			children: <ChatRowContent {...props} message={msg} />
		}));
		return <StyledTimeline items={items} />;
	}
  
	// 根据 api_req_started 消息构建 Timeline 项
	const items = apiReqStartedMessages.map((apiMsg, index) => {
		// 根据 status 确定颜色和图标
		let color = colors.primary; // 默认颜色
		let dot = null; // 默认不设置自定义dot
    
		if (apiMsg.status) {
			switch (apiMsg.status) {
				case 'running':
					color = colors.primary;
					dot = <span className="codicon codicon-loading" style={{ fontSize: '16px', color: colors.primary }} />;
					break;
				case 'error':
					color = colors.error;
					dot = <SVGComponent component={ErrorIcon} height={16} width={16}/>;
					break;
				case 'completed':
					color = colors.success;
					dot = <SVGComponent component={GerySuccessIcon} height={16} width={16}/>;
					break;
				case 'cancelled':
					color = colors.textSecondary;
					dot = <span className="codicon codicon-circle-slash" style={{ fontSize: '16px', color: colors.textSecondary }} />;
					break;
				default:
					color = colors.primary;
					break;
			}
		}

		// 查找当前 api_req_started 消息之后，下一个 api_req_started 消息之前的所有消息
		const currentIndex = messages.indexOf(apiMsg);
		const nextApiIndex = index < apiReqStartedMessages.length - 1 
			? messages.indexOf(apiReqStartedMessages[index + 1]) 
			: messages.length;
    
		// 获取当前 api_req_started 消息后的所有相关消息（不包括下一个 api_req_started）
		const relatedMessages = messages.slice(currentIndex + 1, nextApiIndex);
    
		return {
			color: color, // 设置颜色
			dot: dot, // 设置自定义dot
			children: (
				<div>
					{/* @ts-ignore todo 记得调整ts类型*/}
					<ChatRowContent {...props} message={apiMsg} isInArray={true}/>
					{relatedMessages.map((msg, i) => (
						<RelatedMessageItem key={i} message={msg} props={props} />
					))}
				</div>
			)
		};
	});
  
	return <>
		<AssistantTitle/>
		<StyledTimeline items={items} />
	</>;
};

// 调整内部组件的上、左间距
const RelatedMessageItem = ({ message, props }: { message: ClineMessage, props: ChatRowContentProps }) => {
	const contentRef = useRef<HTMLDivElement>(null);
	const [childMargin, setChildMargin] = useState(0);
	const [childMarginTop, setChildMarginTop] = useState(0);
	
	useEffect(() => {
		if (contentRef.current) {
			// 获取第一个子元素的 margin-left
			const firstChild = contentRef.current.firstElementChild as HTMLElement;
			setChildMargin(getComputedMarginLeft(firstChild));
			setChildMarginTop(getComputedMarginTop(firstChild));
		}
	}, []);
	
	return (
		<MessageContainer $childMargin={childMargin} $childMarginTop={childMarginTop}>
			<div ref={contentRef}>
				<ChatRowContent {...props} message={message} />
			</div>
		</MessageContainer>
	);
};

export const ChatRowContent = (prop: ChatRowContentProps) => {
	const {message} = prop;

	// 如果消息是数组，使用 MessageArray 组件处理
	if (Array.isArray(message)) {
		return <MessageArray messages={message} props={prop} />;
	}

	const tool = useMemo(() => {
		if (message.ask === 'tool' || message.say === 'tool') {
			return JSON.parse(message.text || '{}') as ClineSayTool;
		}
		return null;
	}, [message.ask, message.say, message.text]);

	if (tool) {
		const toolProp = tool as unknown as Tool;
		return <ToolComponent {...toolProp}/>;
	}

	// 由于已经排除了数组类型，message 此时肯定是 ClineMessage 类型
	// 但为了类型安全，还是进行显式类型断言
	return <MessageComponent {...{...prop, message: message as ClineMessage}} />;
};