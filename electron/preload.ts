import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('flowPacket', {
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
})
