"use strict";
const electron = require("electron");
const dairyApi = {
  getAppBootstrap: () => electron.ipcRenderer.invoke("app:get-bootstrap"),
  getAiSettingsStatus: () => electron.ipcRenderer.invoke("app:get-ai-settings-status"),
  saveAiSettings: (input) => electron.ipcRenderer.invoke("app:save-ai-settings", input),
  saveAiApiKey: (input) => electron.ipcRenderer.invoke("app:save-ai-api-key", input),
  chooseWorkspace: () => electron.ipcRenderer.invoke("workspace:choose"),
  readJournalEntry: (input) => electron.ipcRenderer.invoke("journal:read-entry", input),
  createJournalEntry: (input) => electron.ipcRenderer.invoke("journal:create-entry", input),
  saveJournalEntryBody: (input) => electron.ipcRenderer.invoke("journal:save-entry-body", input),
  saveJournalEntryMetadata: (input) => electron.ipcRenderer.invoke("journal:save-entry-metadata", input),
  getJournalMonthActivity: (input) => electron.ipcRenderer.invoke("journal:get-month-activity", input),
  generateDailyInsights: (input) => electron.ipcRenderer.invoke("journal:generate-daily-insights", input),
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
