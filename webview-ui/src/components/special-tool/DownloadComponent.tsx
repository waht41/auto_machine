import { headerStyle, toolIcon } from './common';
import { ComponentRenderer } from './type';
import { Progress, Card, Typography, Space } from 'antd';
import styled from 'styled-components';
import { DownloadProgress } from '@operation/type';

// 样式组件
const DownloadCard = styled(Card)`
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  margin-bottom: 16px;
`;

const HeaderContainer = styled.div`
  ${headerStyle};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Title = styled(Typography.Title)`
  margin: 0;
`;

const InfoContainer = styled.div`
  margin-bottom: 16px;
`;

const ProgressContainer = styled.div`
  margin-bottom: 16px;
`;

const StatusText = styled(Typography.Text)<{ status: string }>`
  display: block;
  margin-top: 8px;
  font-weight: bold;
  color: ${props => {
		switch (props.status) {
			case 'completed': return '#52c41a'; // 成功绿色
			case 'error': return '#f5222d';     // 错误红色
			case 'downloading': return '#1890ff'; // 下载中蓝色
			default: return 'inherit';
		}
	}};
`;

// 格式化字节数为可读形式
const formatBytes = (bytes: number, decimals = 2) => {
	if (bytes === 0) return '0 Bytes';
  
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
	const i = Math.floor(Math.log(bytes) / Math.log(k));
  
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// 下载组件
export const DownloadComponent: ComponentRenderer = (progress: DownloadProgress) => {
	// 获取状态文本
	const getStatusText = (status: string) => {
		switch (status) {
			case 'started': return 'Preparing download...';
			case 'downloading': return 'Downloading...';
			case 'completed': return 'Download completed';
			case 'error': return 'Download error';
			default: return 'Unknown status';
		}
	};
  
	// 获取进度条状态
	const getProgressStatus = (status: string) => {
		switch (status) {
			case 'completed': return 'success';
			case 'error': return 'exception';
			case 'downloading': return 'active';
			default: return 'normal';
		}
	};
  
	return (
		<DownloadCard>
			<HeaderContainer>
				{toolIcon('download')}
				<Title level={4}>File Download</Title>
			</HeaderContainer>
      
			<InfoContainer>
				<Typography.Text>
					{progress.fileName ? `File name: ${progress.fileName}` : 'Downloading file...'}
				</Typography.Text>
        
				<Space direction="vertical" style={{ width: '100%', marginTop: '8px' }}>
					<Typography.Text>
            Downloaded: {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
					</Typography.Text>
				</Space>
			</InfoContainer>
      
			<ProgressContainer>
				<Progress 
					percent={progress.percentage} 
					status={getProgressStatus(progress.status)}
					strokeWidth={8}
					showInfo={true}
				/>
				<StatusText status={progress.status}>
					{getStatusText(progress.status)}
				</StatusText>
			</ProgressContainer>
		</DownloadCard>
	);
};