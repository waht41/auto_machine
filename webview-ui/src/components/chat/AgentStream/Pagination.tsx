import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Tooltip } from 'antd';
import SVGComponent from '@webview-ui/components/common/SVGComponent';
import { ReactComponent as LeftPageIcon } from '@webview-ui/assets/leftPageIcon.svg';
import { ReactComponent as RightPageIcon } from '@webview-ui/assets/rightPageIcon.svg';
import { colors } from '@webview-ui/components/common/styles';

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
`;

const PageButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ScrollIndicatorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  position: relative;
  height: 30px;
  cursor: pointer;
`;

const ScrollTrack = styled.div`
  width: 100%;
  height: 2px;
  background-color: ${colors.backgroundPanel};
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const CompletedTrack = styled.div<{ $width: number }>`
  width: ${props => props.$width}%;
  height: 2px;
  background-color: ${colors.primary};
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 0;
`;

const ScrollIndicator = styled.div<{ $position: number }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${colors.primary};
  background-color: ${colors.backgroundPanel};
  position: absolute;
  top: 50%;
  left: ${props => props.$position}%;
  transform: translate(-50%, -50%);
  cursor: grab;
  transition: left 0.2s ease;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
  }
  
  &:active {
    cursor: grabbing;
  }
`;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ 
	currentPage, 
	totalPages, 
	onPageChange 
}) => {
	const [isDragging, setIsDragging] = useState(false);

	// 处理上一页
	const handlePrevPage = () => {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	};

	// 处理下一页
	const handleNextPage = () => {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	};

	// 处理滚动指示器点击
	const handleScrollTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const container = e.currentTarget;
		const rect = container.getBoundingClientRect();
		const clickPosition = e.clientX - rect.left;
		const containerWidth = rect.width;
		const clickRatio = clickPosition / containerWidth;
    
		// 计算目标页码
		const targetPage = Math.max(1, Math.min(totalPages, Math.round(clickRatio * totalPages)));
		onPageChange(targetPage);
	};

	// 处理指示器鼠标按下事件
	const handleIndicatorMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	// 处理鼠标移动事件
	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (isDragging) {
			const container = document.querySelector('.scroll-indicator-container') as HTMLElement;
			if (!container) return;
      
			const rect = container.getBoundingClientRect();
			const mousePosition = e.clientX - rect.left;
			const containerWidth = rect.width;
      
			// 计算鼠标位置的比例
			let ratio = mousePosition / containerWidth;
			ratio = Math.max(0, Math.min(1, ratio)); // 限制在0-1之间
      
			// 计算目标页码
			const targetPage = Math.max(1, Math.min(totalPages, Math.round(ratio * totalPages) || 1));
			onPageChange(targetPage);
		}
	}, [isDragging, totalPages, onPageChange]);

	// 处理鼠标释放事件
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// 添加和移除全局事件监听
	useEffect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
		}
    
		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isDragging, handleMouseMove, handleMouseUp]);

	// 计算指示器位置
	const indicatorPosition = (currentPage - 1) / Math.max(1, totalPages - 1) * 100 || 0;
	const leftDisabled = currentPage === 1;
	const rightDisabled = currentPage === totalPages;

	return (
		<PaginationContainer>
			<PageButton 
				type="text"
				shape="circle" 
				icon={<SVGComponent component={LeftPageIcon} stroke={leftDisabled ? colors.textPlaceholder : undefined}/>}
				onClick={handlePrevPage}
				disabled={leftDisabled}
			/>
			<PageButton 
				type="text"
				shape="circle" 
				icon={<SVGComponent component={RightPageIcon} stroke={rightDisabled ? colors.textPlaceholder : undefined}/>}
				onClick={handleNextPage}
				disabled={currentPage === totalPages}
			/>
			<ScrollIndicatorContainer 
				onClick={handleScrollTrackClick}
				className="scroll-indicator-container"
			>
				<ScrollTrack />
				<CompletedTrack $width={indicatorPosition} />
				<Tooltip 
					title={`${currentPage} / ${totalPages}`} 
					placement="top"
				>
					<ScrollIndicator 
						$position={indicatorPosition} 
						onMouseDown={handleIndicatorMouseDown}
					/>
				</Tooltip>
			</ScrollIndicatorContainer>
		</PaginationContainer>
	);
};

export default Pagination;
