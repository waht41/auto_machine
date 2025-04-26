import React from 'react';
import styled from 'styled-components';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts';
import { PieTool, ComponentRenderer } from './type';
import { colors } from '../common/styles';

const Container = styled.div`
  width: 100%;
  margin: 20px 0;
`;

const ChartContainer = styled.div`
  background-color: ${colors.backgroundPanel};
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const StyledTooltip = styled.div`
  background-color: ${colors.backgroundPanel};
  border: 1px solid ${colors.borderDivider};
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const TooltipLabel = styled.p`
  margin: 0;
  color: ${colors.textPrimary};
  font-weight: 500;
`;

const TooltipValue = styled.p`
  margin: 4px 0 0;
  color: ${colors.primary};
  font-weight: 600;
`;

// 饼图颜色
const COLORS = [
	colors.primary,
	colors.primaryLight,
	colors.success,
	colors.warning,
	colors.error,
	'#8884d8',
	'#82ca9d',
	'#ffc658',
	'#ff8042',
	'#0088fe'
];

const CustomTooltip = (prop: any) => {
	const { active, payload, nameKey, valueKey } = prop;
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<StyledTooltip>
				<TooltipLabel>名称: {data[nameKey]}</TooltipLabel>
				<TooltipValue>值: {data[valueKey]}</TooltipValue>
			</StyledTooltip>
		);
	}
	return null;
};

const CustomLabel = (props: any) => {
	const { cx, cy, midAngle, innerRadius, outerRadius, percent, nameKey } = props;
	const name = props[nameKey];
	const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
	const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
	const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

	return (
		<text 
			x={x} 
			y={y} 
			fill={colors.textPrimary}
			textAnchor={x > cx ? 'start' : 'end'} 
			dominantBaseline="central"
			fontSize={12}
		>
			{name} ({(percent * 100).toFixed(0)}%)
		</text>
	);
};

export const PieComponent: ComponentRenderer = (tool: PieTool) => {
	const data = Array.isArray(tool.pies) ? tool.pies : [tool.pies].filter(Boolean);
	const [nameKey, valueKey] = tool.keys || ['name', 'value'];

	if (!data || data.length === 0) {
		return <div>无数据可显示</div>;
	}

	return (
		<Container>
			<ChartContainer>
				<ResponsiveContainer width={'90%'} height={400}>
					<PieChart>
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							labelLine={true}
							label={(props) => <CustomLabel {...props} nameKey={nameKey} />}
							outerRadius={120}
							fill={colors.primary}
							dataKey={valueKey}
							nameKey={nameKey}
						>
							{data.map((entry, index) => (
								<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
							))}
						</Pie>
						<Tooltip content={<CustomTooltip nameKey={nameKey} valueKey={valueKey} />} />
						<Legend />
					</PieChart>
				</ResponsiveContainer>
			</ChartContainer>
		</Container>
	);
};
