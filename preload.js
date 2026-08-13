const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', {
  onLog: (callback) => {
    ipcRenderer.on('dsh-log', (_event, line) => callback(line))
  },
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  hasApiKey: () => ipcRenderer.invoke('has-api-key')
})
