import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readSnapshot: () => ipcRenderer.invoke('read-snapshot'),
  writeSnapshot: (snapshot) => ipcRenderer.invoke('write-snapshot', snapshot),
  getAppDataPath: () => ipcRenderer.invoke('app-data-path')
});
