import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Card, Checkbox, Form, Input, message, Space, Tag, Tooltip, Typography } from 'antd';
import { FileAddOutlined } from '@ant-design/icons';
import messageBus from '@webview-ui/store/messageBus';
import { useStateStore } from '@webview-ui/store/stateStore';
import { InternalPrompt } from '@webview-ui/store/type';
import { AssistantStructure } from '@core/storage/type';

const { Title } = Typography;

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
	const location = useLocation();
	console.log('[waht]', 'internalPrompts', internalPrompts);
	const [form] = Form.useForm();
	const [files, setFiles] = useState<Files>({});
	const [isEditing, setIsEditing] = useState(false);
	const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
	
	// Check if we're editing an existing assistant using location state
	useEffect(() => {
		const state = location.state as { assistantToEdit?: AssistantStructure } | null;
		const assistantToEdit = state?.assistantToEdit;
		
		if (assistantToEdit) {
			// Set form values
			form.setFieldsValue({
				name: assistantToEdit.name,
				description: assistantToEdit.description || '',
				prompt: assistantToEdit.prompt || '',
				selectedPrompts: assistantToEdit.internalPrompts?.map(p => p.name) || []
			});
			
			// Convert file array to object format for the component
			if (assistantToEdit.files && assistantToEdit.files.length > 0) {
				const filesObj: Files = {};
				assistantToEdit.files.forEach(file => {
					filesObj[file.fileName] = {
						content: file.content,
						path: file.fileName // Use filename as path since we don't have the original path
					};
				});
				setFiles(filesObj);
			}
			
			// Set editing state
			setIsEditing(true);
			setEditingAssistantId(assistantToEdit.id);
		}
	}, [form, location]);

	const handleSubmit = async (values: any) => {
		console.log('Assistant form submitted:', values);

		// Convert files object to array format expected by the backend
		const filesArray = Object.entries(files).map(([fileName, fileData]) => ({
			fileName,
			content: fileData.content
		}));

		// 获取选中的提示模板名称
		const selectedPromptNames = values.selectedPrompts || [];

		// 获取选中的完整提示模板对象
		const selectedPrompts = internalPrompts.filter(p =>
			selectedPromptNames.includes(p.name)
		);

		// Use existing ID if editing, otherwise generate a new one
		let uuid = editingAssistantId || '';
		if (!uuid) {
			try {
				const result = await messageBus.invokeElectron({
					type: 'generateUUID'
				});
				uuid = result.uuid || `assistant-${Date.now()}`;
			} catch (error) {
				// 如果 Electron 调用失败，使用时间戳作为备选方案
				uuid = `assistant-${Date.now()}`;
				console.error('Failed to generate UUID:', error);
			}
		}

		// Create assistant config in the format expected by the backend
		const assistant: AssistantStructure = {
			id: uuid,
			name: values.name,
			description: values.description,
			prompt: values.prompt,
			files: filesArray,
			internalPrompts: selectedPrompts
		};

		console.log('Complete assistant config:', assistant);

		// Send the properly formatted assistant data to the background
		messageBus.sendToBackground({
			type: 'upsertAssistant',
			assistant
		});

		// Show success message based on whether we were editing or creating
		if (isEditing) {
			message.success(`Assistant "${values.name}" updated successfully`);
		} else {
			message.success(`Assistant "${values.name}" created successfully`);
		}
		
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
				<Title level={2}>{isEditing ? 'Edit Assistant' : 'Create Assistant'}</Title>
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
							selectedPrompts: []
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
							rules={[{ required: false, message: 'Please enter a system prompt' }]}
						>
							<div style={{ marginBottom: '16px' }}>
								<Form.Item name="selectedPrompts" noStyle>
									<Checkbox.Group
										style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
										onChange={(checkedValues) => {
											// 保存选中的提示模板名称，不进行内容提取和拼接
											const selectedPromptNames = checkedValues as string[];

											// 更新表单中的selectedPrompts字段
											form.setFieldsValue({ selectedPrompts: selectedPromptNames });
										}}
									>
										{internalPrompts.map((prompt: InternalPrompt) => (
											<Tooltip key={prompt.name} title={prompt.description}>
												<Checkbox value={prompt.name}>{prompt.name}</Checkbox>
											</Tooltip>
										))}
									</Checkbox.Group>
								</Form.Item>
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
			</ContentContainer>
		</Container>
	);
};

export default AssistantView;
