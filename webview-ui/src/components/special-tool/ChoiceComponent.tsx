import { headerStyle, toolIcon } from './common';
import { vscode } from '../../utils/vscode';
import { ComponentRenderer } from './type';
import { Button, Radio, Checkbox, Space, Typography, Card } from 'antd';
import { useState, useEffect } from 'react';
import styled from 'styled-components';

// 样式组件
const ChoiceCard = styled(Card)`
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

const QuestionText = styled(Typography.Text)`
  display: block;
  margin-bottom: 16px;
  font-size: 16px;
`;

const OptionsContainer = styled.div`
  margin-bottom: 16px;
`;

const ButtonContainer = styled(Space)`
  display: flex;
  justify-content: flex-end;
`;

const ResultText = styled(Typography.Text)`
  color: #52c41a;
  font-weight: bold;
`;

// 单选组件
export const ChoiceComponent: ComponentRenderer = (tool) => {
	console.log('[waht]', tool);
	const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);
	
	// 如果已经有结果，则设置为选中状态
	useEffect(() => {
		if (tool.result) {
			setSelectedValue(tool.result);
		}
	}, [tool.result]);
	
	const handleConfirm = () => {
		if (selectedValue) {
			vscode.postMessage({
				type: 'answer',
				payload: {result: selectedValue, uuid: tool.uuid}
			});
		}
	};
	
	return (
		<ChoiceCard>
			<HeaderContainer>
				{toolIcon('question')}
				<Title level={4}>Roo has a question:</Title>
			</HeaderContainer>
			
			<QuestionText>{tool.question}</QuestionText>
			
			<OptionsContainer>
				<Radio.Group 
					value={selectedValue} 
					onChange={(e) => setSelectedValue(e.target.value)}
				>
					<Space direction="vertical">
						{tool.choices.map((choice: string) => (
							<Radio key={choice} value={choice}>
								{choice}
							</Radio>
						))}
					</Space>
				</Radio.Group>
			</OptionsContainer>
			
			{tool.result ? (
				<ResultText>You have chosen: {tool.result}</ResultText>
			) : (
				<ButtonContainer>
					<Button 
						type="primary" 
						onClick={handleConfirm}
						disabled={!selectedValue}
					>
						Confirm
					</Button>
				</ButtonContainer>
			)}
		</ChoiceCard>
	);
};

// 多选组件
export const MultiChoiceComponent: ComponentRenderer = (tool) => {
	console.log('[waht]', tool);
	const [selectedValues, setSelectedValues] = useState<string[]>([]);
	
	// 如果已经有结果，则设置为选中状态
	useEffect(() => {
		if (tool.result) {
			// 假设结果是逗号分隔的字符串
			const resultArray = typeof tool.result === 'string' 
				? tool.result.split(',') 
				: Array.isArray(tool.result) ? tool.result : [];
			setSelectedValues(resultArray);
		}
	}, [tool.result]);
	
	const handleConfirm = () => {
		if (selectedValues.length > 0) {
			vscode.postMessage({
				type: 'answer',
				payload: {result: selectedValues, uuid: tool.uuid}
			});
		}
	};
	
	return (
		<ChoiceCard>
			<HeaderContainer>
				{toolIcon('question')}
				<Title level={4}>Roo has multiple choices:</Title>
			</HeaderContainer>
			
			<QuestionText>{tool.question}</QuestionText>
			
			<OptionsContainer>
				<Checkbox.Group 
					value={selectedValues} 
					onChange={(values) => setSelectedValues(values as string[])}
				>
					<Space direction="vertical">
						{tool.choices.map((choice: string) => (
							<Checkbox key={choice} value={choice}>
								{choice}
							</Checkbox>
						))}
					</Space>
				</Checkbox.Group>
			</OptionsContainer>
			
			{tool.result ? (
				<ResultText>
					You have chosen: {Array.isArray(tool.result) ? tool.result.join(', ') : tool.result}
				</ResultText>
			) : (
				<ButtonContainer>
					<Button 
						type="primary" 
						onClick={handleConfirm}
						disabled={selectedValues.length === 0}
					>
						Confirm
					</Button>
				</ButtonContainer>
			)}
		</ChoiceCard>
	);
};