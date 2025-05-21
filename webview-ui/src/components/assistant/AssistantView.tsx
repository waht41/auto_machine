import React from 'react';
import styled from 'styled-components';
import { Button, Card, Form, Input, Space, Typography } from 'antd';

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

const AssistantView: React.FC<AssistantViewProps> = ({ onDone }) => {
	const [form] = Form.useForm();

	const handleSubmit = (values: any) => {
		console.log('Assistant form submitted:', values);
		// Here you would handle saving the assistant configuration
		onDone();
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
							rules={[{ required: true, message: 'Please enter a description' }]}
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
							<Input.TextArea
								placeholder="Enter the system prompt for your assistant"
								rows={6}
							/>
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
