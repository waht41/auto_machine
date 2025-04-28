import React from 'react';
import styled from 'styled-components';
import { Typography } from 'antd';
import { RobotOutlined, CodeOutlined, BookOutlined } from '@ant-design/icons';
import { colors } from '../common/styles';
import { useChatViewStore } from '@webview-ui/store/chatViewStore';

const { Text } = Typography;

// 示例项目数据结构
interface ExampleItem {
  icon: React.ReactNode;
  text: string;
}

// 组件容器样式
const ExampleContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  width: 90%;
  margin: 0 auto;
  background-color: ${colors.backgroundMain};
`;

// 单个示例项目样式
const ExampleItemWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background-color: ${colors.primaryLight};
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
  }
`;

// 图标样式
const IconWrapper = styled.div`
  margin-right: 8px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// 文本样式
const TextWrapper = styled(Text)`
  max-width: 600px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// 示例数据（写死在组件内）
const exampleItems: ExampleItem[] = [
	{ icon: <BookOutlined />, text: 'please take a look at the files on my desktop ' },
	{ icon: <RobotOutlined />, text: 'please help me analyze data  and draw a diagram to illustrate them' },
	{ icon: <CodeOutlined />, text: 'Please search latest news about cursor, windsurf, manus at the same time, and explain it to me comprehensively' },
];

const NewerExample: React.FC = () => {
	const handleSend = useChatViewStore(state => state.handleSendMessage);
	return (
		<ExampleContainer>
			{exampleItems.map((item, index) => (
				<ExampleItemWrapper key={index} onClick={(e) =>{
					e.stopPropagation();
					handleSend(item.text);
				}}>
					<IconWrapper>{item.icon}</IconWrapper>
					<TextWrapper>{item.text}</TextWrapper>
				</ExampleItemWrapper>
			))}
		</ExampleContainer>
	);
};

export default NewerExample;
