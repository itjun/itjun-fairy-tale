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
  toggleFullscreen: () => ipcRenderer.invoke('garden:fullscreen'),
  restart: () => ipcRenderer.invoke('garden:restart'),
  listBackups: () => ipcRenderer.invoke('garden:backup-list'),
  createBackup: garden => ipcRenderer.invoke('garden:backup-create', garden),
  restoreBackup: id => ipcRenderer.invoke('garden:backup-restore', id),
  onCloseFailed: callback => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('garden:close-failed', listener);
    return () => ipcRenderer.removeListener('garden:close-failed', listener);
  },
  // isShown 只告诉主进程确认页已经画出来了，不算做了决定。
  decideClose: (token, isExit, isShown) => ipcRenderer.send('garden:close-decision', { token, isExit: isExit === true, isShown: isShown === true }),
});
