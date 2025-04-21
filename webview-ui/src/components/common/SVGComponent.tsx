import React from 'react';
import styled from 'styled-components';

interface SVGComponentProps {
  src: React.FC<React.SVGProps<SVGSVGElement>>;
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
}

const SVGComponent: React.FC<SVGComponentProps> = ({
	src,
	width = 24,
	height = 24,
	fill,
	stroke,
	strokeWidth,
	strokeLinecap,
	strokeLinejoin,
	...restProps
}) => {
	// 创建一个带有样式属性的 styled component
	const StyledSVG = styled(src)<StyledSVGProps>`
    width: ${props => props.$width || width}px;
    height: ${props => props.$height || height}px;
    
    path {
      ${props => props.$fill && `fill: ${props.$fill} !important`};
      ${props => props.$stroke && `stroke: ${props.$stroke} !important`};
      ${props => props.$strokeWidth && `stroke-width: ${props.$strokeWidth} !important`};
      ${props => props.$strokeLinecap && `stroke-linecap: ${props.$strokeLinecap} !important`};
      ${props => props.$strokeLinejoin && `stroke-linejoin: ${props.$strokeLinejoin} !important`};
    }
  `;

	return (
		<StyledSVG
			{...restProps}
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