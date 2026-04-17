"use strict";
const electron = require("electron");
const dairyApi = {
  getAppBootstrap: () => electron.ipcRenderer.invoke("app:get-bootstrap"),
  getAiSettingsStatus: () => electron.ipcRenderer.invoke("app:get-ai-settings-status"),
  setWindowZoomFactor: (input) => electron.ipcRenderer.invoke("app:set-window-zoom-factor", input),
  onWindowZoomFactorChanged: (listener) => {
    const wrappedListener = (_event, payload) => {
      if (typeof (payload == null ? void 0 : payload.zoomFactor) === "number") {
        listener(payload.zoomFactor);
      }
    };
    electron.ipcRenderer.on("app:window-zoom-changed", wrappedListener);
    return () => {
      electron.ipcRenderer.removeListener("app:window-zoom-changed", wrappedListener);
    };
  },
  saveAiSettings: (input) => electron.ipcRenderer.invoke("app:save-ai-settings", input),
  saveAiApiKey: (input) => electron.ipcRenderer.invoke("app:save-ai-api-key", input),
  chooseWorkspace: () => electron.ipcRenderer.invoke("workspace:choose"),
  readJournalEntry: (input) => electron.ipcRenderer.invoke("journal:read-entry", input),
  createJournalEntry: (input) => electron.ipcRenderer.invoke("journal:create-entry", input),
  saveJournalEntryBody: (input) => electron.ipcRenderer.invoke("journal:save-entry-body", input),
  saveJournalEntryMetadata: (input) => electron.ipcRenderer.invoke("journal:save-entry-metadata", input),
  getJournalMonthActivity: (input) => electron.ipcRenderer.invoke("journal:get-month-activity", input),
  generateDailyInsights: (input) => electron.ipcRenderer.invoke("journal:generate-daily-insights", input),
  generateRangeReport: (input) => electron.ipcRenderer.invoke("report:generate-range-report", input),
  getRangeReport: (input) => electron.ipcRenderer.invoke("report:get-range-report", input),
  listRangeReports: (workspacePath) => electron.ipcRenderer.invoke("report:list-range-reports", workspacePath),
  exportRangeReportPng: (input) => electron.ipcRenderer.invoke("report:export-png", input),
  getReportExportPayload: (input) => electron.ipcRenderer.invoke("report:get-export-payload", input),
  notifyReportExportReady: (input) => electron.ipcRenderer.invoke("report:export-ready", input),
  getWorkspaceTags: (workspacePath) => electron.ipcRenderer.invoke("workspace:get-tags", workspacePath),
  getWorkspaceWeatherOptions: (workspacePath) => electron.ipcRenderer.invoke("workspace:get-weather-options", workspacePath),
  getWorkspaceLocationOptions: (workspacePath) => electron.ipcRenderer.invoke("workspace:get-location-options", workspacePath),
  setWorkspaceTags: (input) => electron.ipcRenderer.invoke("workspace:set-tags", input),
  setWorkspaceWeatherOptions: (input) => electron.ipcRenderer.invoke("workspace:set-weather-options", input),
  setWorkspaceLocationOptions: (input) => electron.ipcRenderer.invoke("workspace:set-location-options", input),
  setJournalHeatmapEnabled: (input) => electron.ipcRenderer.invoke("app:set-journal-heatmap-enabled", input),
  setDayStartHour: (input) => electron.ipcRenderer.invoke("app:set-day-start-hour", input),
  setFrontmatterVisibility: (input) => electron.ipcRenderer.invoke("app:set-frontmatter-visibility", input),
  setWindowDirtyState: (input) => electron.ipcRenderer.invoke("app:set-window-dirty-state", input),
  openExternalLink: (input) => electron.ipcRenderer.invoke("app:open-external-link", input),
  openDevTools: () => electron.ipcRenderer.invoke("app:open-dev-tools")
};
electron.contextBridge.exposeInMainWorld("dairy", dairyApi);
