import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronApi',{
	send: (channel: string, data: any) => ipcRenderer.send(channel, data),
	invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
	on: (channel: any, callback: any) => ipcRenderer.on(channel, (_event: any,data: any)=>callback(data)),
});

// 在 DOM 加载完成后添加链接点击事件监听
window.addEventListener('DOMContentLoaded', () => {
	// 添加全局点击事件委托，处理所有 a 标签的点击
	document.addEventListener('click', (event) => {
		const target = event.target as HTMLElement;
		// 检查点击的是否是 a 标签或 a 标签的子元素
		const linkElement = target.closest('a');
		
		if (linkElement && linkElement.href) {
			// 阻止默认行为（在 Electron 内打开）
			event.preventDefault();
			
			// 通过 Electron API 直接调用主进程的 electron 通道
			ipcRenderer.invoke('electron', {
				type: 'openExternal',
				url: linkElement.href
			});
		}
	});
});
