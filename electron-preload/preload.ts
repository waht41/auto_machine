const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});

contextBridge.exposeInMainWorld('message',{
    on: (channel, callback) => ipcRenderer.on(channel, callback),
})

contextBridge.exposeInMainWorld('vscode',{
    postMessage: (message) => ipcRenderer.send('vscode-message', message),
})