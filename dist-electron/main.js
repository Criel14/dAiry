import { app, BrowserWindow, Menu, ipcMain, dialog } from "electron";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const APP_ICON_NAME = process.platform === "win32" ? "app.ico" : "app.png";
const APP_ICON_PATH = path.join(process.env.APP_ROOT, "build", "icons", APP_ICON_NAME);
const IPC_CHANNELS = {
  getBootstrap: "app:get-bootstrap",
  chooseWorkspace: "workspace:choose",
  readJournalEntry: "journal:read-entry",
  createJournalEntry: "journal:create-entry",
  saveJournalEntry: "journal:save-entry"
};
const DEFAULT_APP_CONFIG = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system"
  }
};
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function getConfigFilePath() {
  return path.join(app.getPath("userData"), "config.json");
}
function normalizeAppConfig(rawValue) {
  var _a, _b, _c;
  if (!rawValue || typeof rawValue !== "object") {
    return DEFAULT_APP_CONFIG;
  }
  const config = rawValue;
  const recentWorkspaces = Array.isArray(config.recentWorkspaces) ? config.recentWorkspaces.filter((item) => typeof item === "string") : [];
  const theme = ((_a = config.ui) == null ? void 0 : _a.theme) === "light" || ((_b = config.ui) == null ? void 0 : _b.theme) === "dark" || ((_c = config.ui) == null ? void 0 : _c.theme) === "system" ? config.ui.theme : "system";
  return {
    lastOpenedWorkspace: typeof config.lastOpenedWorkspace === "string" ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme
    }
  };
}
async function readAppConfig() {
  try {
    const fileContent = await readFile(getConfigFilePath(), "utf-8");
    return normalizeAppConfig(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      return DEFAULT_APP_CONFIG;
    }
    throw error;
  }
}
async function writeAppConfig(config) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), "utf-8");
}
function buildWorkspaceConfig(workspacePath, currentConfig) {
  const nextRecentWorkspaces = [
    workspacePath,
    ...currentConfig.recentWorkspaces.filter((item) => item !== workspacePath)
  ];
  return {
    ...currentConfig,
    lastOpenedWorkspace: workspacePath,
    recentWorkspaces: nextRecentWorkspaces.slice(0, 8)
  };
}
function assertValidDate(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error("日期格式无效，必须为 YYYY-MM-DD。");
  }
}
function resolveJournalEntryPath({ workspacePath, date }) {
  assertValidDate(date);
  const [year, month] = date.split("-");
  return path.join(workspacePath, "journal", year, month, `${date}.md`);
}
async function readJournalEntry(input) {
  const filePath = resolveJournalEntryPath(input);
  try {
    const content = await readFile(filePath, "utf-8");
    return {
      status: "ready",
      filePath,
      content
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        status: "missing",
        filePath,
        content: null
      };
    }
    throw error;
  }
}
async function createJournalEntry(input) {
  const filePath = resolveJournalEntryPath(input);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, "", { encoding: "utf-8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  return readJournalEntry(input);
}
async function saveJournalEntry(input) {
  const filePath = resolveJournalEntryPath(input);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.content, "utf-8");
  return {
    filePath,
    savedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async () => {
    const config = await readAppConfig();
    return { config };
  });
  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async () => {
    const currentConfig = await readAppConfig();
    const dialogOptions = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    };
    const result = win ? await dialog.showOpenDialog(win, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
        workspacePath: null,
        config: currentConfig
      };
    }
    const workspacePath = result.filePaths[0];
    const nextConfig = buildWorkspaceConfig(workspacePath, currentConfig);
    await writeAppConfig(nextConfig);
    return {
      canceled: false,
      workspacePath,
      config: nextConfig
    };
  });
  ipcMain.handle(IPC_CHANNELS.readJournalEntry, (_event, input) => {
    return readJournalEntry(input);
  });
  ipcMain.handle(IPC_CHANNELS.createJournalEntry, (_event, input) => {
    return createJournalEntry(input);
  });
  ipcMain.handle(
    IPC_CHANNELS.saveJournalEntry,
    (_event, input) => {
      return saveJournalEntry(input);
    }
  );
}
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    icon: APP_ICON_PATH,
    title: "dAiry",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
