import React from 'react';
import styled from 'styled-components';
import { Card, Timeline, Typography, Tag } from 'antd';

const { Title, Text } = Typography;

const StreamContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 16px;
`;

const StreamCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const StreamHeader = styled.div`
  margin-bottom: 16px;
`;

// 模拟数据
const mockStreamData = [
	{
		id: 1,
		type: '思考',
		content: '分析用户请求，需要查询数据库获取相关信息',
		timestamp: '12:05:32'
	},
	{
		id: 2,
		type: '执行',
		content: '执行数据库查询: SELECT * FROM products WHERE category = "electronics"',
		timestamp: '12:05:35'
	},
	{
		id: 3,
		type: '结果',
		content: '查询返回了15条记录，正在处理数据',
		timestamp: '12:05:38'
	},
	{
		id: 4,
		type: '思考',
		content: '根据用户偏好对结果进行排序，优先展示高评分商品',
		timestamp: '12:05:42'
	},
	{
		id: 5,
		type: '执行',
		content: '调用排序算法，按评分降序排列',
		timestamp: '12:05:45'
	}
];

const AgentStream = () => {
	return (
		<StreamContainer>
			<StreamHeader>
				<Title level={4}>执行流程</Title>
				<Text type="secondary">实时展示AI处理过程</Text>
			</StreamHeader>
      
			<StreamCard>
				<Timeline>
					{mockStreamData.map(item => (
						<Timeline.Item key={item.id} color={
							item.type === '思考' ? 'blue' : 
								item.type === '执行' ? 'green' : 
									'orange'
						}>
							<div>
								<Tag color={
									item.type === '思考' ? 'blue' : 
										item.type === '执行' ? 'green' : 
											'orange'
								}>
									{item.type}
								</Tag>
								<Text type="secondary" style={{ fontSize: '12px' }}>{item.timestamp}</Text>
							</div>
							<div style={{ marginTop: '8px' }}>
								<Text>{item.content}</Text>
							</div>
						</Timeline.Item>
					))}
				</Timeline>
			</StreamCard>
		</StreamContainer>
	);
};

export default AgentStream;