import { contextBridge, ipcRenderer } from 'electron'
import type { DairyApi } from '../src/types/api'
import type { RightPanel } from '../src/types/ui'

// preload 只暴露明确的业务接口，不把整个 ipcRenderer 敞开给渲染进程。
// 这样后面排查权限边界或审计能力时会轻松很多。
const dairyApi: DairyApi = {
  getAppBootstrap: () => ipcRenderer.invoke('app:get-bootstrap'),
  getThemePreference: () => ipcRenderer.invoke('app:get-theme-preference'),
  getAiSettingsStatus: () => ipcRenderer.invoke('app:get-ai-settings-status'),
  setThemePreference: (input) => ipcRenderer.invoke('app:set-theme-preference', input),
  setWindowZoomFactor: (input) => ipcRenderer.invoke('app:set-window-zoom-factor', input),
  onWindowZoomFactorChanged: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { zoomFactor?: unknown } | undefined,
    ) => {
      if (typeof payload?.zoomFactor === 'number') {
        listener(payload.zoomFactor)
      }
    }

    ipcRenderer.on('app:window-zoom-changed', wrappedListener)

    return () => {
      ipcRenderer.removeListener('app:window-zoom-changed', wrappedListener)
    }
  },
  onNavigateMainPanel: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { panel?: unknown } | undefined,
    ) => {
      const panel = payload?.panel

      if (panel === 'journal' || panel === 'reports' || panel === 'settings') {
        listener(panel as RightPanel)
      }
    }

    ipcRenderer.on('app:navigate-main-panel', wrappedListener)

    return () => {
      ipcRenderer.removeListener('app:navigate-main-panel', wrappedListener)
    }
  },
  saveAiSettings: (input) => ipcRenderer.invoke('app:save-ai-settings', input),
  saveAiApiKey: (input) => ipcRenderer.invoke('app:save-ai-api-key', input),
  getAiContext: () => ipcRenderer.invoke('app:get-ai-context'),
  saveAiContext: (input) => ipcRenderer.invoke('app:save-ai-context', input),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  openWorkspaceFolder: (input) => ipcRenderer.invoke('workspace:open-folder', input),
  readJournalEntry: (input) => ipcRenderer.invoke('journal:read-entry', input),
  createJournalEntry: (input) => ipcRenderer.invoke('journal:create-entry', input),
  saveJournalEntryBody: (input) => ipcRenderer.invoke('journal:save-entry-body', input),
  saveJournalEntryMetadata: (input) => ipcRenderer.invoke('journal:save-entry-metadata', input),
  getJournalMonthActivity: (input) => ipcRenderer.invoke('journal:get-month-activity', input),
  generateDailyInsights: (input) => ipcRenderer.invoke('journal:generate-daily-insights', input),
  generateRangeReport: (input) => ipcRenderer.invoke('report:generate-range-report', input),
  getRangeReport: (input) => ipcRenderer.invoke('report:get-range-report', input),
  listRangeReports: (workspacePath) => ipcRenderer.invoke('report:list-range-reports', workspacePath),
  exportRangeReportPng: (input) => ipcRenderer.invoke('report:export-png', input),
  getReportExportPayload: (input) => ipcRenderer.invoke('report:get-export-payload', input),
  notifyReportExportReady: (input) => ipcRenderer.invoke('report:export-ready', input),
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
  setWindowCloseBehavior: (input) => ipcRenderer.invoke('app:set-window-close-behavior', input),
  setNotificationPreference: (input) => ipcRenderer.invoke('app:set-notification-preference', input),
  setFrontmatterVisibility: (input) => ipcRenderer.invoke('app:set-frontmatter-visibility', input),
  setWindowDirtyState: (input) => ipcRenderer.invoke('app:set-window-dirty-state', input),
  openExternalLink: (input) => ipcRenderer.invoke('app:open-external-link', input),
  openDevTools: () => ipcRenderer.invoke('app:open-dev-tools'),
}

contextBridge.exposeInMainWorld('dairy', dairyApi)
