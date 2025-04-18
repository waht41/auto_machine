import { Menu, BrowserWindow } from 'electron';

/**
 * 创建应用程序菜单
 * @param mainWindow 主窗口实例
 * @param sendToWorker 发送消息到 worker 的函数
 */
export function createMenu(mainWindow: BrowserWindow, sendToWorker?: (message: any) => void) {
	// 获取默认菜单模板
	const template = Menu.getApplicationMenu()?.items.map(item => {
		return {
			label: item.label,
			submenu: item.submenu
		};
	}) || [];
	// template = []

	// 添加自定义菜单项
	template.push({
		label: 'Cline',
		submenu: [
			{
				label: 'New Task',
				click: async () => {
					mainWindow.webContents.send('message', {
						type: 'action',
						action: 'chatButtonClicked'
					});
					sendToWorker?.({type: 'clearTask'});
				},
				accelerator: undefined,
				type: 'normal',
				role: undefined
			},
			{
				label: 'MCP',
				click: () => {
					mainWindow.webContents.send('message', {
						type: 'action',
						action: 'mcpButtonClicked'
					});
				},
				accelerator: undefined,
				type: 'normal',
				role: undefined
			},
			// {
			//     label: 'Prompts',
			//     click: () => {
			//         mainWindow.webContents.send('message', {
			//             type: "action",
			//             action: "promptsButtonClicked"
			//         });
			//     },
			//     accelerator: undefined,
			//     type: 'normal',
			//     role: undefined
			// },
			{
				label: 'Settings',
				click: () => {
					mainWindow.webContents.send('message', {
						type: 'action',
						action: 'settingsButtonClicked'
					});
				},
				accelerator: undefined,
				type: 'normal',
				role: undefined
			},
			{
				label: 'History',
				click: () => {
					mainWindow.webContents.send('message', {
						type: 'action',
						action: 'historyButtonClicked'
					});
				},
				accelerator: undefined,
				type: 'normal',
				role: undefined
			}
		]
	});

	const menu = Menu.buildFromTemplate(template as any);
	Menu.setApplicationMenu(menu);
}
