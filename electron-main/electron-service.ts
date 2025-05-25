import { BrowserWindow, dialog, shell, clipboard, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import * as crypto from 'crypto';

/**
 * Electron 服务类 - 集中管理所有 Electron 相关功能
 */
export class ElectronService {
	constructor(private win?: BrowserWindow) {}

	/**
   * 处理来自 worker 或其他来源的消息
   * @param message 消息对象
   * @returns 处理结果
   */
	public async handleMessage(message: any): Promise<any> {
		if (!message || typeof message !== 'object' || !message.type) {
			return { success: false, error: 'Invalid message format' };
		}

		// 根据消息类型分发到不同的处理函数
		switch (message.type) {
			case 'export':
				return this.handleExport(message);
			case 'openDialog':
				return this.handleOpenDialog(message);
			case 'saveDialog':
				return this.handleSaveDialog(message);
			case 'openExternal':
				return this.handleOpenExternal(message);
			case 'clipboard':
				return this.handleClipboard(message);
			case 'systemInfo':
				return this.handleSystemInfo();
			case 'themeInfo':
				return this.handleThemeInfo();
			case 'openFile':
				return this.handleOpenFile(message);
			case 'openFolder':
				return this.handleOpenFolder(message);
			case 'readFile':
				return this.handleReadFile();
			case 'generateUUID':
				return this.handleGenerateUUID();
			default:
				return { success: false, error: `Unknown message type: ${message.type}` };
		}
	}

	/**
   * 处理导出文件功能
   */
	private async handleExport(message: any): Promise<any> {
		if (!this.win || this.win.isDestroyed()) {
			return { success: false, error: 'Window is not available' };
		}

		try {
			const result = await dialog.showOpenDialog(this.win, {
				properties: ['openDirectory']
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			const selectedPath = result.filePaths[0];
			const filePath = path.join(selectedPath, message.title);

			fs.writeFileSync(filePath, message.content);

			return {
				success: true,
				filePath
			};
		} catch (error) {
			console.error('Export error:', error);
			return {
				success: false,
				error: error.message || 'Failed to export file'
			};
		}
	}

	/**
   * 处理打开文件/文件夹对话框
   */
	private async handleOpenDialog(message: any): Promise<any> {
		if (!this.win || this.win.isDestroyed()) {
			return { success: false, error: 'Window is not available' };
		}

		try {
			const options = {
				...message.options,
				properties: message.properties || ['openFile']
			};

			const result = await dialog.showOpenDialog(this.win, options);
			return {
				success: true,
				canceled: result.canceled,
				filePaths: result.filePaths
			};
		} catch (error) {
			console.error('Open dialog error:', error);
			return {
				success: false,
				error: error.message || 'Failed to open dialog'
			};
		}
	}

	/**
   * 处理保存文件对话框
   */
	private async handleSaveDialog(message: any): Promise<any> {
		if (!this.win || this.win.isDestroyed()) {
			return { success: false, error: 'Window is not available' };
		}

		try {
			const options = {
				...message.options,
				defaultPath: message.defaultPath,
				filters: message.filters
			};

			const result = await dialog.showSaveDialog(this.win, options);

			if (result.canceled || !result.filePath) {
				return { success: false, canceled: true };
			}

			if (message.content) {
				fs.writeFileSync(result.filePath, message.content);
			}

			return {
				success: true,
				filePath: result.filePath
			};
		} catch (error) {
			console.error('Save dialog error:', error);
			return {
				success: false,
				error: error.message || 'Failed to save file'
			};
		}
	}

	/**
   * 处理在默认浏览器中打开 URL
   */
	private async handleOpenExternal(message: any): Promise<any> {
		try {
			if (!message.url) {
				return { success: false, error: 'URL is required' };
			}

			await shell.openExternal(message.url);
			return { success: true };
		} catch (error) {
			console.error('Open external error:', error);
			return {
				success: false,
				error: error.message || 'Failed to open URL'
			};
		}
	}

	/**
   * 处理剪贴板操作
   */
	private handleClipboard(message: any): any {
		try {
			if (message.action === 'copy') {
				if (!message.text) {
					return { success: false, error: 'Text is required for copy operation' };
				}
				clipboard.writeText(message.text);
				return { success: true };
			} else if (message.action === 'read') {
				const text = clipboard.readText();
				return { success: true, text };
			}

			return { success: false, error: 'Invalid clipboard action' };
		} catch (error) {
			console.error('Clipboard error:', error);
			return {
				success: false,
				error: error.message || 'Failed to perform clipboard operation'
			};
		}
	}

	/**
   * 获取系统信息
   */
	private handleSystemInfo(): any {
		try {
			return {
				success: true,
				platform: process.platform,
				arch: process.arch,
				version: process.version,
				osVersion: os.release(),
				osType: os.type(),
				hostname: os.hostname(),
				homedir: os.homedir(),
				tmpdir: os.tmpdir(),
				cpus: os.cpus().length,
				memory: {
					total: os.totalmem(),
					free: os.freemem()
				}
			};
		} catch (error) {
			console.error('System info error:', error);
			return {
				success: false,
				error: error.message || 'Failed to get system information'
			};
		}
	}

	/**
   * 获取主题信息
   */
	private handleThemeInfo(): any {
		try {
			return {
				success: true,
				shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
				themeSource: nativeTheme.themeSource
			};
		} catch (error) {
			console.error('Theme info error:', error);
			return {
				success: false,
				error: error.message || 'Failed to get theme information'
			};
		}
	}

	/**
   * 打开文件
   */
	private async handleOpenFile(message: any): Promise<any> {
		try {
			if (!message.filePath) {
				return {success: false, error: 'File path is required'};
			}

			await shell.openPath(message.filePath);
			return {success: true};
		} catch (error) {
			console.error('Open file error:', error);
			return {
				success: false,
				error: error.message || 'Failed to open file'
			};
		}
	}

	/**
   * 打开文件夹
   * 如果路径是文件，则打开所在的文件夹并聚焦该文件
   * 如果路径是文件夹，则直接打开文件夹
   */
	private async handleOpenFolder(message: any): Promise<any> {
		try {
			if (!message.path) {
				return {success: false, error: 'Path is required'};
			}

			const filePath = message.path;

			// 检查路径是否存在
			if (!fs.existsSync(filePath)) {
				return {success: false, error: 'Path does not exist'};
			}

			// 判断是文件还是文件夹
			const stats = fs.statSync(filePath);

			if (stats.isFile()) {
				// 如果是文件，打开所在文件夹并聚焦该文件

				// 在 Windows 上使用 explorer.exe 命令作为备选方案
				if (process.platform === 'win32') {
					try {
						// 使用 /select 参数可以打开文件所在的文件夹并选中该文件
						exec(`explorer.exe /select,"${filePath}"`);
					} catch (explorerError) {
						console.error('Explorer command failed:', explorerError);
						// 如果 explorer 命令失败，尝试使用 shell.showItemInFolder 作为备选
						shell.showItemInFolder(filePath);
					}
				} else {
					// 在非 Windows 平台上使用 Electron 的 shell API
					shell.showItemInFolder(filePath);
				}
			} else if (stats.isDirectory()) {
				// 如果是文件夹，直接打开文件夹
				await shell.openPath(filePath);
			} else {
				return {success: false, error: 'Path is neither a file nor a directory'};
			}

			return {success: true};
		} catch (error) {
			console.error('Open folder error:', error);
			return {
				success: false,
				error: error.message || 'Failed to open folder'
			};
		}
	}

	/**
   * 添加文件
   * 选择源文件并返回文件内容和路径
   */
	private async handleReadFile(): Promise<any> {
		if (!this.win || this.win.isDestroyed()) {
			return { success: false, error: 'Window is not available' };
		}

		try {
			// 选择源文件
			const sourceResult = await dialog.showOpenDialog(this.win, {
				title: 'choose file you want to add',
				buttonLabel: 'choose',
				properties: ['openFile']
			});

			if (sourceResult.canceled || sourceResult.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			const sourcePath = sourceResult.filePaths[0];

			// 读取文件内容
			let content = '';
			try {
				// 尝试读取为文本
				content = fs.readFileSync(sourcePath, 'utf-8');
			} catch (readError) {
				console.warn('Could not read file as text, returning empty content:', readError);
				return {
					success: false,
					error: 'Could not read file as text',
				};
			}

			return {
				success: true,
				filePath: sourcePath,
				content: content
			};
		} catch (error) {
			console.error('Add file error:', error);
			return {
				success: false,
				error: error.message || 'Failed to add file'
			};
		}
	}

	/**
	 * 生成 UUID
	 */
	private handleGenerateUUID(): any {
		try {
			const uuid = crypto.randomUUID();
			return {
				success: true,
				uuid
			};
		} catch (error) {
			console.error('Generate UUID error:', error);
			return {
				success: false,
				error: error.message || 'Failed to generate UUID'
			};
		}
	}
}
