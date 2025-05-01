import React from 'react';
import styled from 'styled-components';

interface SVGComponentProps {
  component: React.FC<React.SVGProps<SVGSVGElement>>;
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
}

// 为 styled-components 创建接口，确保它能识别样式属性
interface StyledSVGProps {
  $fill?: string;
  $stroke?: string;
  $strokeWidth?: number | string;
  $strokeLinecap?: 'butt' | 'round' | 'square';
  $strokeLinejoin?: 'miter' | 'round' | 'bevel';
  $width?: number | string;
  $height?: number | string;
  as: React.FC<React.SVGProps<SVGSVGElement>>;
}

// 创建一个基础的 SVG 容器组件
const StyledSVGBase = styled.svg<StyledSVGProps>`
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  
  path {
    ${props => props.$fill && `fill: ${props.$fill} !important`};
    ${props => props.$stroke && `stroke: ${props.$stroke} !important`};
    ${props => props.$strokeWidth && `stroke-width: ${props.$strokeWidth} !important`};
    ${props => props.$strokeLinecap && `stroke-linecap: ${props.$strokeLinecap} !important`};
    ${props => props.$strokeLinejoin && `stroke-linejoin: ${props.$strokeLinejoin} !important`};
  }
`;

const SVGComponent: React.FC<SVGComponentProps> = ({
	component,
	width = 24,
	height = 24,
	fill,
	stroke,
	strokeWidth,
	strokeLinecap,
	strokeLinejoin,
	...restProps
}) => {
	return (
		<StyledSVGBase
			{...restProps}
			as={component}
			$fill={fill}
			$stroke={stroke}
			$strokeWidth={strokeWidth}
			$strokeLinecap={strokeLinecap}
			$strokeLinejoin={strokeLinejoin}
			$width={width}
			$height={height}
		/>
	);
};

export default SVGComponent;