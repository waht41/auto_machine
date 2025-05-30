import { ComponentRenderer } from '@webview-ui/components/special-tool/type';
import { ParallelProp, ClineStatus, ClineIdentifier } from '@/shared/type';
import { List, Typography, Space } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useChatViewTabStore } from '@webview-ui/store/chatViewTabStore';
import messageBus from '@webview-ui/store/messageBus';

const { Text, Paragraph } = Typography;

const TaskItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #f5f5f5;
  }
`;

const TaskContent = styled(Paragraph)`
  flex: 1;
  margin-bottom: 0 !important;
`;

const TaskStatus = styled(Text)<{ status: ClineStatus }>`
  margin-right: 8px;
  color: ${props => {
		switch (props.status) {
			case 'completed':
				return '#52c41a'; // 绿色
			case 'error':
				return '#f5222d'; // 红色
			case 'running':
				return '#1890ff'; // 蓝色
			case 'pending':
				return '#faad14'; // 黄色
			default:
				return '#8c8c8c'; // 灰色
		}
	}};
`;

export const ParallelComponent: ComponentRenderer = (prop: ParallelProp) => {
	const { clines } = prop;
	const openTab = useChatViewTabStore(state => state.openTab);
	
	const handleTaskClick = (task: ClineIdentifier) => {
		messageBus.sendToBackground({type: 'setTaskId', taskId: task.id});
		openTab({activeKey: task.id, label:task.task});
	};
	return (
		<List
			dataSource={clines}
			renderItem={(task) => (
				<TaskItem onClick={() => handleTaskClick(task)}>
					<TaskContent
						ellipsis={{ rows: 1, tooltip: task.task }}
					>
						{task.task}
					</TaskContent>
					<Space>
						<TaskStatus status={task.status}>{task.status}</TaskStatus>
						<RightOutlined />
					</Space>
				</TaskItem>
			)}
		/>
	);
};