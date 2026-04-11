import { contextBridge, ipcRenderer } from 'electron'
import type { DairyApi } from '../src/types/dairy'

// preload 只暴露明确的业务接口，不把整个 ipcRenderer 敞开给渲染进程。
// 这样后面排查权限边界或审计能力时会轻松很多。
const dairyApi: DairyApi = {
  getAppBootstrap: () => ipcRenderer.invoke('app:get-bootstrap'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  readJournalEntry: (input) => ipcRenderer.invoke('journal:read-entry', input),
  createJournalEntry: (input) => ipcRenderer.invoke('journal:create-entry', input),
  saveJournalEntryBody: (input) => ipcRenderer.invoke('journal:save-entry-body', input),
  saveJournalEntryMetadata: (input) => ipcRenderer.invoke('journal:save-entry-metadata', input),
  getJournalMonthActivity: (input) => ipcRenderer.invoke('journal:get-month-activity', input),
  getWorkspaceTags: (workspacePath) => ipcRenderer.invoke('workspace:get-tags', workspacePath),
  getWorkspaceWeatherOptions: (workspacePath) =>
    ipcRenderer.invoke('workspace:get-weather-options', workspacePath),
  getWorkspaceLocationOptions: (workspacePath) =>
    ipcRenderer.invoke('workspace:get-location-options', workspacePath),
  setWorkspaceTags: (input) => ipcRenderer.invoke('workspace:set-tags', input),
  setWorkspaceWeatherOptions: (input) => ipcRenderer.invoke('workspace:set-weather-options', input),
  setWorkspaceLocationOptions: (input) => ipcRenderer.invoke('workspace:set-location-options', input),
  setJournalHeatmapEnabled: (input) => ipcRenderer.invoke('app:set-journal-heatmap-enabled', input),
  setDayStartHour: (input) => ipcRenderer.invoke('app:set-day-start-hour', input),
  setFrontmatterVisibility: (input) => ipcRenderer.invoke('app:set-frontmatter-visibility', input),
  setWindowDirtyState: (input) => ipcRenderer.invoke('app:set-window-dirty-state', input),
}

contextBridge.exposeInMainWorld('dairy', dairyApi)
