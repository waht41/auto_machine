import React from 'react';
import styled from 'styled-components';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { LineTool, ComponentRenderer } from './type';
import { colors } from '../common/styles';

const Container = styled.div`
  width: 100%;
  height: 300px;
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

const CustomTooltip = (prop: any) => {
	const { active, payload, xKey, yKey, labelKey } = prop;
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<StyledTooltip>
				<TooltipLabel>{labelKey}: {data[labelKey]}</TooltipLabel>
				<TooltipValue>{xKey}: {data[xKey]}</TooltipValue>
				<TooltipValue>{yKey}: {data[yKey]}</TooltipValue>
			</StyledTooltip>
		);
	}
	return null;
};

export const LineComponent: ComponentRenderer = (tool: LineTool) => {
	const data = Array.isArray(tool.lines) ? tool.lines : [tool.lines].filter(Boolean);
	const [xKey, yKey, labelKey] = tool.keys || ['x', 'y', 'label'];

	if (!data || data.length === 0) {
		return <div>无数据可显示</div>;
	}

	return (
		<Container>
			<ChartContainer>
				<ResponsiveContainer width={'90%'} height={400}>
					<LineChart
						data={data}
						margin={{
							top: 20,
							right: 30,
							left: 20,
							bottom: 30,
						}}
					>
						<CartesianGrid strokeDasharray="3 3" stroke={colors.borderDivider} />
						<XAxis
							dataKey={xKey}
							tick={{ fill: colors.textSecondary }}
							axisLine={{ stroke: colors.borderDivider }}
						/>
						<YAxis
							tick={{ fill: colors.textSecondary }}
							axisLine={{ stroke: colors.borderDivider }}
						/>
						<Tooltip content={<CustomTooltip xKey={xKey} yKey={yKey} labelKey={labelKey} />} />
						<Line 
							type="monotone"
							dataKey={yKey} 
							stroke={colors.primary}
							activeDot={{ r: 8 }}
						>
							<LabelList 
								dataKey={labelKey} 
								position="top" 
								fill={colors.textPrimary} 
								fontSize={12} 
								formatter={(value: string) => value || ''}
							/>
						</Line>
					</LineChart>
				</ResponsiveContainer>
			</ChartContainer>
		</Container>
	);
};
