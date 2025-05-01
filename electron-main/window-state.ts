import { app, Rectangle, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface WindowState {
  isMaximized: boolean;
  bounds?: Rectangle;
  displayId?: string; // 添加显示器ID
}

export class WindowStateManager {
	private filePath: string;
	private state: WindowState;

	constructor() {
		// 设置配置文件路径
		this.filePath = path.join(app.getPath('userData'), 'window-state.json');
    
		// 初始化默认状态
		this.state = {
			isMaximized: true
		};

		this.loadState();
	}

	// 加载保存的窗口状态
	private loadState(): void {
		try {
			if (fs.existsSync(this.filePath)) {
				const data = fs.readFileSync(this.filePath, 'utf8');
				const savedState = JSON.parse(data) as WindowState;
        
				// 确保数据有效
				if (savedState && 
            (savedState.isMaximized !== undefined || 
             (savedState.bounds && 
              typeof savedState.bounds.x === 'number' && 
              typeof savedState.bounds.y === 'number' && 
              typeof savedState.bounds.width === 'number' && 
              typeof savedState.bounds.height === 'number'))) {
					this.state = savedState;
				}
			}
		} catch (error) {
			console.error('加载窗口状态失败:', error);
		}
	}

	// 保存窗口状态
	saveState(isMaximized: boolean, bounds?: Rectangle, displayId?: string): void {
		try {
			this.state = {
				isMaximized,
				bounds,
				displayId
			};
      
			fs.writeFileSync(this.filePath, JSON.stringify(this.state), 'utf8');
		} catch (error) {
			console.error('保存窗口状态失败:', error);
		}
	}

	// 获取窗口状态
	getState(): WindowState {
		return this.state;
	}

	// 获取窗口应该显示的位置
	getWindowPosition(): { x?: number; y?: number } {
		// 如果没有保存的位置信息，返回undefined让系统自动决定
		if (!this.state.bounds || !this.state.displayId) {
			return {};
		}

		// 获取所有显示器
		const displays = screen.getAllDisplays();
		
		// 查找保存的显示器ID对应的显示器
		const targetDisplay = displays.find(display => 
			display.id.toString() === this.state.displayId
		);

		// 如果找不到对应的显示器，返回保存的位置
		if (!targetDisplay) {
			return { 
				x: this.state.bounds.x, 
				y: this.state.bounds.y 
			};
		}

		// 确保窗口位置在目标显示器的可见区域内
		const { x, y, width, height } = this.state.bounds;
		const { bounds: displayBounds } = targetDisplay;

		// 确保窗口至少有一部分在显示器内
		const isWindowVisible = 
			x < displayBounds.x + displayBounds.width &&
			x + width > displayBounds.x &&
			y < displayBounds.y + displayBounds.height &&
			y + height > displayBounds.y;

		// 如果窗口在目标显示器可见区域内，使用保存的位置
		if (isWindowVisible) {
			return { x, y };
		}

		// 否则，将窗口居中显示在目标显示器上
		return {
			x: displayBounds.x + (displayBounds.width - width) / 2,
			y: displayBounds.y + (displayBounds.height - height) / 2
		};
	}
}
