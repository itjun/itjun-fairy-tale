const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('gardenDesktop', {
  updateState: () => ipcRenderer.invoke('garden:update-state'),
  checkUpdate: () => ipcRenderer.invoke('garden:check-update'),
  updateSafe: safe => ipcRenderer.send('garden:update-safe', safe === true),
  onUpdate: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('garden:update-state', listener);
    return () => ipcRenderer.removeListener('garden:update-state', listener);
  },
  toggleMaximize: () => ipcRenderer.invoke('garden:maximize'),
  quit: () => ipcRenderer.invoke('garden:quit'),
  onPrepareClose: callback => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('garden:prepare-close', listener);
    return () => ipcRenderer.removeListener('garden:prepare-close', listener);
  },
  finishClose: (token, isSaved) => ipcRenderer.send('garden:close-ready', { token, isSaved: isSaved === true }),
});
