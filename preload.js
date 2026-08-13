const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', {
  onLog: (callback) => {
    ipcRenderer.on('dsh-log', (_event, line) => callback(line))
  }
})
