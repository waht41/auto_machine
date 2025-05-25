import React, { useState } from 'react';
import styled from 'styled-components';
import { Button, Card, Form, Input, Space, Typography, message, Tag, Tooltip, Dropdown } from 'antd';
import { FileAddOutlined, DownOutlined } from '@ant-design/icons';
import messageBus from '@webview-ui/store/messageBus';
import crypto from 'crypto';
import { useStateStore } from '@webview-ui/store/stateStore';
import { InternalPrompt } from '@webview-ui/store/type';

const { Title, Paragraph } = Typography;

interface AssistantViewProps {
  onDone: () => void;
}

const Container = styled.div`
  padding: 24px;
  height: 100%;
  overflow: auto;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const StyledCard = styled(Card)`
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

interface FileItem {
	content: string;
	path: string;
}

interface Files {
	[filename: string]: FileItem;
}

const AssistantView: React.FC<AssistantViewProps> = ({ onDone }) => {
	const internalPrompts = useStateStore(state => state.internalPrompt);
	const [form] = Form.useForm();
	const [files, setFiles] = useState<Files>({});

	const handleSubmit = (values: any) => {
		console.log('Assistant form submitted:', values);

		// Convert files object to array format expected by the backend
		const filesArray = Object.entries(files).map(([fileName, fileData]) => ({
			fileName,
			content: fileData.content
		}));

		// Create assistant config in the format expected by the backend
		const assistant = {
			id: crypto.randomUUID(),
			name: values.name,
			description: values.description,
			prompt: values.prompt,
			files: filesArray
		};

		console.log('Complete assistant config:', assistant);

		// Send the properly formatted assistant data to the background
		messageBus.sendToBackground({
			type: 'upsertAssistant',
			assistant
		});

		// Close the assistant configuration view
		onDone();
	};

	const handleAddFile = async () => {
		try {
			// 使用Electron API添加文件，并等待响应
			const result = await messageBus.invokeElectron({
				type: 'readFile'
			});

			if (result.success) {
				// 获取文件名 - 使用自定义函数而不是path.basename
				const filename = getFilenameFromPath(result.filePath);

				// 将文件添加到files中
				setFiles(prevFiles => ({
					...prevFiles,
					[filename]: {
						content: result.content,
						path: result.filePath
					}
				}));

				// Display success message
				message.success(`File added successfully: ${filename}`);
			} else if (result.canceled) {
				message.info('File addition canceled');
			} else {
				message.error(`Failed to add file: ${result.error || 'Unknown error'}`);
			}
		} catch (error: any) {
			console.error('File addition error:', error);
			message.error(`Error adding file: ${error?.message || 'Unknown error'}`);
		}
	};

	// 从路径中提取文件名的函数
	const getFilenameFromPath = (filepath: string): string => {
		// 处理不同操作系统的路径分隔符
		const parts = filepath.split(/[\\/]/);
		// 返回最后一个元素（文件名）
		return parts[parts.length - 1] || filepath;
	};

	const handleRemoveFile = (filename: string) => {
		setFiles(prevFiles => {
			const newFiles = { ...prevFiles };
			delete newFiles[filename];
			return newFiles;
		});
		message.success(`File removed: ${filename}`);
	};

	return (
		<Container>
			<HeaderContainer>
				<Title level={2}>Assistant Configuration</Title>
				<Button type="primary" onClick={onDone}>
          Back
				</Button>
			</HeaderContainer>

			<ContentContainer>
				<StyledCard>
					<Form
						form={form}
						layout="vertical"
						onFinish={handleSubmit}
						initialValues={{
							name: '',
							description: '',
							prompt: '',
						}}
					>
						<Form.Item
							name="name"
							label="Assistant Name"
							rules={[{ required: true, message: 'Please enter a name for your assistant' }]}
						>
							<Input placeholder="Enter assistant name" />
						</Form.Item>

						<Form.Item
							name="description"
							label="Description"
							rules={[{ required: false, message: 'Please enter a description' }]}
						>
							<Input.TextArea
								placeholder="Enter a description for your assistant"
								rows={3}
							/>
						</Form.Item>

						<Form.Item
							name="prompt"
							label="System Prompt"
							rules={[{ required: true, message: 'Please enter a system prompt' }]}
						>
							<div style={{ marginBottom: '8px' }}>
								<Dropdown
									menu={{
										items: internalPrompts.map((prompt: InternalPrompt) => ({
											key: prompt.name,
											label: (
												<Tooltip title={prompt.description}>
													<span>{prompt.name}</span>
												</Tooltip>
											)
										})),
										onClick: (info) => {
											const selectedPrompt = internalPrompts.find(p => p.name === info.key);
											if (selectedPrompt) {
												form.setFieldsValue({ prompt: selectedPrompt.content });
												message.success(`Loaded prompt: ${selectedPrompt.name}`);
											}
										}
									}}
								>
									<Button style={{ marginBottom: '8px' }}>
										Select Prompt Template <DownOutlined />
									</Button>
								</Dropdown>
							</div>
							<Input.TextArea
								placeholder="Enter the system prompt for your assistant"
								rows={6}
							/>
						</Form.Item>

						<Form.Item label="Attached Files">
							<div style={{ marginBottom: '8px' }}>
								<Button
									icon={<FileAddOutlined />}
									onClick={handleAddFile}
								>
									Add File
								</Button>
							</div>

							<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
								{Object.entries(files).map(([filename, fileData]) => (
									<Tooltip key={filename} title={fileData.path}>
										<Tag
											closable
											onClose={() => handleRemoveFile(filename)}
											color="blue"
										>
											{filename}
										</Tag>
									</Tooltip>
								))}
							</div>
						</Form.Item>

						<Form.Item>
							<Space>
								<Button type="primary" htmlType="submit">
                  Save Assistant
								</Button>
								<Button onClick={onDone}>
                  Cancel
								</Button>
							</Space>
						</Form.Item>
					</Form>
				</StyledCard>

				<StyledCard>
					<Title level={4}>Assistant Templates</Title>
					<Paragraph>
            Choose from pre-configured assistant templates or create your own custom assistant.
					</Paragraph>
					{/* Template cards would go here */}
				</StyledCard>
			</ContentContainer>
		</Container>
	);
};

export default AssistantView;
