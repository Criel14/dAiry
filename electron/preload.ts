import { contextBridge, ipcRenderer } from 'electron'
import type { DairyApi } from '../src/types/api'
import type { RightPanel } from '../src/types/ui'
import { IPC_CHANNELS } from '../src/shared/ipc-channels'

const dairyApi: DairyApi = {
  getAppBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.getBootstrap),
  getThemePreference: () => ipcRenderer.invoke(IPC_CHANNELS.getThemePreference),
  getAiSettingsStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getAiSettingsStatus),
  setThemePreference: (input) => ipcRenderer.invoke(IPC_CHANNELS.setThemePreference, input),
  setWindowZoomFactor: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowZoomFactor, input),
  onWindowZoomFactorChanged: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { zoomFactor?: unknown } | undefined,
    ) => {
      if (typeof payload?.zoomFactor === 'number') {
        listener(payload.zoomFactor)
      }
    }

    ipcRenderer.on(IPC_CHANNELS.windowZoomChanged, wrappedListener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowZoomChanged, wrappedListener)
    }
  },
  onNavigateMainPanel: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { panel?: unknown } | undefined,
    ) => {
      const panel = payload?.panel

      if (panel === 'journal' || panel === 'reports' || panel === 'settings' || panel === 'timeline') {
        listener(panel as RightPanel)
      }
    }

    ipcRenderer.on(IPC_CHANNELS.navigateMainPanel, wrappedListener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.navigateMainPanel, wrappedListener)
    }
  },
  saveAiSettings: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveAiSettings, input),
  saveAiApiKey: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveAiApiKey, input),
  getSupplement: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.getSupplement, workspacePath),
  saveSupplement: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveSupplement, input),
  chooseWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.chooseWorkspace),
  openWorkspaceFolder: (input) => ipcRenderer.invoke(IPC_CHANNELS.openWorkspaceFolder, input),
  readJournalEntry: (input) => ipcRenderer.invoke(IPC_CHANNELS.readJournalEntry, input),
  createJournalEntry: (input) => ipcRenderer.invoke(IPC_CHANNELS.createJournalEntry, input),
  saveJournalEntryBody: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveJournalEntryBody, input),
  saveJournalEntryMetadata: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveJournalEntryMetadata, input),
  getJournalMonthActivity: (input) => ipcRenderer.invoke(IPC_CHANNELS.getJournalMonthActivity, input),
  getJournalYearsWithEntries: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getJournalYearsWithEntries, workspacePath),
  generateDailyInsights: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateDailyInsights, input),
  rebuildJournalMetaIndex: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.rebuildJournalMetaIndex, workspacePath),
  rebuildUserProfile: (input) => ipcRenderer.invoke(IPC_CHANNELS.rebuildUserProfile, input),
  cancelUserProfileRebuild: () => ipcRenderer.invoke(IPC_CHANNELS.cancelUserProfileRebuild),
  onUserProfileRebuildProgress: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { month?: unknown; index?: unknown; total?: unknown } | undefined,
    ) => {
      if (
        typeof payload?.month === 'string' &&
        typeof payload?.index === 'number' &&
        typeof payload?.total === 'number'
      ) {
        listener({ month: payload.month, index: payload.index, total: payload.total })
      }
    }

    ipcRenderer.on(IPC_CHANNELS.userProfileRebuildProgress, wrappedListener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.userProfileRebuildProgress, wrappedListener)
    }
  },
  generateRangeReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateRangeReport, input),
  getRangeReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.getRangeReport, input),
  listRangeReports: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.listRangeReports, workspacePath),
  exportRangeReportPng: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportRangeReportPng, input),
  getReportExportPayload: (input) => ipcRenderer.invoke(IPC_CHANNELS.getReportExportPayload, input),
  notifyReportExportReady: (input) => ipcRenderer.invoke(IPC_CHANNELS.notifyReportExportReady, input),
  notifyReportExportError: (input) => ipcRenderer.invoke(IPC_CHANNELS.notifyReportExportError, input),
  getWorkspaceTags: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceTags, workspacePath),
  getWorkspaceWeatherOptions: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceWeatherOptions, workspacePath),
  getWorkspaceLocationOptions: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceLocationOptions, workspacePath),
  setWorkspaceTags: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceTags, input),
  setWorkspaceWeatherOptions: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceWeatherOptions, input),
  setWorkspaceLocationOptions: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceLocationOptions, input),
  setJournalHeatmapEnabled: (input) => ipcRenderer.invoke(IPC_CHANNELS.setJournalHeatmapEnabled, input),
  setDayStartHour: (input) => ipcRenderer.invoke(IPC_CHANNELS.setDayStartHour, input),
  setWindowCloseBehavior: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowCloseBehavior, input),
  setLaunchOnStartupPreference: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.setLaunchOnStartupPreference, input),
  setNotificationPreference: (input) => ipcRenderer.invoke(IPC_CHANNELS.setNotificationPreference, input),
  getEmailNotificationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getEmailNotificationStatus),
  saveEmailNotificationAuthCode: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveEmailNotificationAuthCode, input),
  setFrontmatterVisibility: (input) => ipcRenderer.invoke(IPC_CHANNELS.setFrontmatterVisibility, input),
  setWindowDirtyState: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowDirtyState, input),
  setMcpPreference: (input) => ipcRenderer.invoke(IPC_CHANNELS.setMcpPreference, input),
  getMcpRuntimeStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getMcpRuntimeStatus),
  openExternalLink: (input) => ipcRenderer.invoke(IPC_CHANNELS.openExternalLink, input),
  openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.openDevTools),
  showMessageBox: (input) => ipcRenderer.invoke(IPC_CHANNELS.showMessageBox, input),
  getTimeline: (input) => ipcRenderer.invoke(IPC_CHANNELS.getTimeline, input),
  rebuildTimeline: (input) => ipcRenderer.invoke(IPC_CHANNELS.rebuildTimeline, input),
  cancelTimelineRebuild: () => ipcRenderer.invoke(IPC_CHANNELS.cancelTimelineRebuild),
  addTimelineDayEvent: (input) => ipcRenderer.invoke(IPC_CHANNELS.addTimelineDayEvent, input),
  onTimelineRebuildProgress: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { weekLabel?: unknown; current?: unknown; total?: unknown } | undefined,
    ) => {
      if (
        typeof payload?.weekLabel === 'string' &&
        typeof payload?.current === 'number' &&
        typeof payload?.total === 'number'
      ) {
        listener({ weekLabel: payload.weekLabel, current: payload.current, total: payload.total })
      }
    }

    ipcRenderer.on(IPC_CHANNELS.timelineRebuildProgress, wrappedListener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.timelineRebuildProgress, wrappedListener)
    }
  },
  listBillsByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsByMonth, input),
  listBillsByYear: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsByYear, input),
  listBillsYears: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsYears, input),
  listBillsMonths: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsMonths, input),
  createBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.createBill, input),
  updateBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateBill, input),
  deleteBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteBill, input),
  getBillCategories: (input) => ipcRenderer.invoke(IPC_CHANNELS.getBillCategories, input),
  createBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.createBillCategory, input),
  renameBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.renameBillCategory, input),
  deleteBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteBillCategory, input),
  exportBillsExcel: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportBillsExcel, input),
}

contextBridge.exposeInMainWorld('dairy', dairyApi)
