import { contextBridge, ipcRenderer } from 'electron'
import type { DairyApi } from '../src/types/dairy'

// preload 只暴露明确的业务接口，不把整个 ipcRenderer 敞开给渲染进程。
// 这样后面排查权限边界或审计能力时会轻松很多。
const dairyApi: DairyApi = {
  getAppBootstrap: () => ipcRenderer.invoke('app:get-bootstrap'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  readJournalEntry: (input) => ipcRenderer.invoke('journal:read-entry', input),
  createJournalEntry: (input) => ipcRenderer.invoke('journal:create-entry', input),
  saveJournalEntry: (input) => ipcRenderer.invoke('journal:save-entry', input),
  getJournalMonthActivity: (input) => ipcRenderer.invoke('journal:get-month-activity', input),
  setJournalHeatmapEnabled: (input) => ipcRenderer.invoke('app:set-journal-heatmap-enabled', input),
}

contextBridge.exposeInMainWorld('dairy', dairyApi)
