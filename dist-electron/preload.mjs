"use strict";
const electron = require("electron");
const dairyApi = {
  getAppBootstrap: () => electron.ipcRenderer.invoke("app:get-bootstrap"),
  chooseWorkspace: () => electron.ipcRenderer.invoke("workspace:choose"),
  readJournalEntry: (input) => electron.ipcRenderer.invoke("journal:read-entry", input),
  createJournalEntry: (input) => electron.ipcRenderer.invoke("journal:create-entry", input),
  saveJournalEntry: (input) => electron.ipcRenderer.invoke("journal:save-entry", input)
};
electron.contextBridge.exposeInMainWorld("dairy", dairyApi);
