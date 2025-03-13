const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi',{
	send: (channel: string, data: any) => ipcRenderer.send(channel, data),
	invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
	on: (channel: any, callback: any) => ipcRenderer.on(channel, (_event: any,data: any)=>callback(data)),
});
