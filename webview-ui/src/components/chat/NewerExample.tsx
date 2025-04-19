import React from 'react';
import styled from 'styled-components';
import { Typography } from 'antd';
import { FileTextOutlined, RobotOutlined, CodeOutlined, BulbOutlined, ToolOutlined, BookOutlined } from '@ant-design/icons';

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
  width: 100%;
  margin: 0 auto;
`;

// 单个示例项目样式
const ExampleItemWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.04);
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
	{ icon: <FileTextOutlined />, text: 'Please gather information on a few different topics at the same time' },
	{ icon: <RobotOutlined />, text: 'please search latest news about AI Agent' },
	{ icon: <CodeOutlined />, text: 'Please gather information on a few different topics at the same time' },
	{ icon: <BulbOutlined />, text: 'please search latest news about AI Agent please search latest news about AI Agentplease search latest news about AI Agent' },
	{ icon: <ToolOutlined />, text: 'Please gather information on a few different topics at the same time' },
	{ icon: <BookOutlined />, text: 'please search latest news about AI Agent' },
];

const NewerExample: React.FC = () => {
	return (
		<ExampleContainer>
			{exampleItems.map((item, index) => (
				<ExampleItemWrapper key={index}>
					<IconWrapper>{item.icon}</IconWrapper>
					<TextWrapper>{item.text}</TextWrapper>
				</ExampleItemWrapper>
			))}
		</ExampleContainer>
	);
};

export default NewerExample;
