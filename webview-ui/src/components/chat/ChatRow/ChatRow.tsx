import deepEqual from 'fast-deep-equal';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useSize } from 'react-use';
import { ClineMessage, ClineSayTool } from '@/shared/ExtensionMessage';
import { ToolComponent } from '../../special-tool';
import { Tool } from '../../special-tool/type';
import { MessageComponent } from '@webview-ui/components/chat/ChatRow/render-block/router';
import { ShowedMessage } from '@webview-ui/components/chat/type';
import { Timeline } from 'antd';
import { AssistantTitle } from '@webview-ui/components/chat/ChatRow/Header';

interface ChatRowProps {
	message: ShowedMessage;
	isExpanded: boolean
	onToggleExpand: () => void
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
}

export type ChatRowContentProps = Omit<ChatRowProps, 'onHeightChange'>

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
		}, [height, isLast, onHeightChange, message]);

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow;
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
);

export default ChatRow;

// 渲染消息数组的函数
const renderMessageArray = (messages: ClineMessage[], props: ChatRowContentProps) => {
	// 筛选出 api_req_started 类型的消息作为 Timeline 的项
	const apiReqStartedMessages = messages.filter(msg => msg.say === 'api_req_started');
	
	// 如果没有 api_req_started 消息，则使用普通方式渲染所有消息
	if (apiReqStartedMessages.length === 0) {
		const items = messages.map((msg) => ({
			children: <ChatRowContent {...props} message={msg} />
		}));
		return <Timeline items={items} />;
	}
	
	// 根据 api_req_started 消息构建 Timeline 项
	const items = apiReqStartedMessages.map((apiMsg, index) => {
		// 根据 status 确定颜色和图标
		let color = 'blue'; // 默认颜色
		let dot = null; // 默认不设置自定义dot
		
		if (apiMsg.status) {
			switch (apiMsg.status) {
				case 'running':
					color = 'blue';
					dot = <span className="codicon codicon-loading" style={{ fontSize: '16px', color: 'blue' }} />;
					break;
				case 'error':
					color = 'red';
					dot = <span className="codicon codicon-error" style={{ fontSize: '16px', color: 'red' }} />;
					break;
				case 'completed':
					color = 'green';
					dot = <span className="codicon codicon-check" style={{ fontSize: '16px', color: 'green' }} />;
					break;
				case 'cancelled':
					color = 'gray';
					dot = <span className="codicon codicon-circle-slash" style={{ fontSize: '16px', color: 'gray' }} />;
					break;
				default:
					color = 'blue';
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
						<div key={i} style={{ marginLeft: '20px', marginTop: '8px' }}>
							<ChatRowContent {...props} message={msg} />
						</div>
					))}
				</div>
			)
		};
	});
	
	return <>
		<AssistantTitle/>
		<Timeline items={items} />
	</>;
};

export const ChatRowContent = (prop: ChatRowContentProps) => {
	const {message} = prop;

	// 如果消息是数组，使用 renderMessageArray 函数处理
	if (Array.isArray(message)) {
		return renderMessageArray(message, prop);
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