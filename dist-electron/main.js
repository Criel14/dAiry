import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import { readFile, mkdir, writeFile, stat, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const APP_ICON_NAME = process.platform === "win32" ? "app.ico" : "app.png";
const APP_ICON_PATH = path.join(process.env.APP_ROOT, "build", "icons", APP_ICON_NAME);
const IPC_CHANNELS = {
  getBootstrap: "app:get-bootstrap",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
  setFrontmatterVisibility: "app:set-frontmatter-visibility",
  setWindowDirtyState: "app:set-window-dirty-state",
  chooseWorkspace: "workspace:choose",
  getWorkspaceTags: "workspace:get-tags",
  getWorkspaceWeatherOptions: "workspace:get-weather-options",
  getWorkspaceLocationOptions: "workspace:get-location-options",
  setWorkspaceTags: "workspace:set-tags",
  setWorkspaceWeatherOptions: "workspace:set-weather-options",
  setWorkspaceLocationOptions: "workspace:set-location-options",
  readJournalEntry: "journal:read-entry",
  createJournalEntry: "journal:create-entry",
  saveJournalEntryBody: "journal:save-entry-body",
  saveJournalEntryMetadata: "journal:save-entry-metadata",
  getJournalMonthActivity: "journal:get-month-activity"
};
const DEFAULT_APP_CONFIG = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    journalHeatmapEnabled: false,
    frontmatterVisibility: {
      weather: true,
      location: true,
      summary: true,
      tags: true
    }
  }
};
const EMPTY_METADATA = {
  weather: "",
  location: "",
  summary: "",
  tags: []
};
const DEFAULT_WEATHER_OPTIONS = [
  "晴",
  "多云",
  "阴",
  "小雨",
  "大雨",
  "雷阵雨",
  "小雪",
  "大雪",
  "雾"
];
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let isWindowDirty = false;
let isForceClosingWindow = false;
function getConfigFilePath() {
  return path.join(app.getPath("userData"), "config.json");
}
function normalizeAppConfig(rawValue) {
  var _a, _b, _c, _d, _e;
  if (!rawValue || typeof rawValue !== "object") {
    return DEFAULT_APP_CONFIG;
  }
  const config = rawValue;
  const recentWorkspaces = Array.isArray(config.recentWorkspaces) ? config.recentWorkspaces.filter((item) => typeof item === "string") : [];
  const theme = ((_a = config.ui) == null ? void 0 : _a.theme) === "light" || ((_b = config.ui) == null ? void 0 : _b.theme) === "dark" || ((_c = config.ui) == null ? void 0 : _c.theme) === "system" ? config.ui.theme : "system";
  const journalHeatmapEnabled = ((_d = config.ui) == null ? void 0 : _d.journalHeatmapEnabled) === true;
  const frontmatterVisibility = normalizeFrontmatterVisibility((_e = config.ui) == null ? void 0 : _e.frontmatterVisibility);
  return {
    lastOpenedWorkspace: typeof config.lastOpenedWorkspace === "string" ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
      journalHeatmapEnabled,
      frontmatterVisibility
    }
  };
}
function normalizeFrontmatterVisibility(rawValue) {
  return {
    weather: (rawValue == null ? void 0 : rawValue.weather) !== false,
    location: (rawValue == null ? void 0 : rawValue.location) !== false,
    summary: (rawValue == null ? void 0 : rawValue.summary) !== false,
    tags: (rawValue == null ? void 0 : rawValue.tags) !== false
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
async function setJournalHeatmapEnabled(input) {
  const currentConfig = await readAppConfig();
  const nextConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      journalHeatmapEnabled: input.enabled
    }
  };
  await writeAppConfig(nextConfig);
  return nextConfig;
}
async function setFrontmatterVisibility(input) {
  const currentConfig = await readAppConfig();
  const nextConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      frontmatterVisibility: normalizeFrontmatterVisibility(input.visibility)
    }
  };
  await writeAppConfig(nextConfig);
  return nextConfig;
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
function assertValidMonth(monthText) {
  if (!/^\d{4}-\d{2}$/.test(monthText)) {
    throw new Error("月份格式无效，必须为 YYYY-MM。");
  }
}
function resolveJournalEntryFilePath(workspacePath, date) {
  assertValidDate(date);
  const [year, month] = date.split("-");
  return path.join(workspacePath, "journal", year, month, `${date}.md`);
}
function resolveJournalEntryPath({ workspacePath, date }) {
  return resolveJournalEntryFilePath(workspacePath, date);
}
function getWorkspaceMetadataDir(workspacePath) {
  return path.join(workspacePath, ".dairy");
}
function getWorkspaceTagLibraryPath(workspacePath) {
  return path.join(getWorkspaceMetadataDir(workspacePath), "tags.json");
}
function getWorkspaceWeatherLibraryPath(workspacePath) {
  return path.join(getWorkspaceMetadataDir(workspacePath), "weather.json");
}
function getWorkspaceLocationLibraryPath(workspacePath) {
  return path.join(getWorkspaceMetadataDir(workspacePath), "locations.json");
}
function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }
  const uniqueTags = /* @__PURE__ */ new Set();
  for (const tag of tags) {
    if (typeof tag !== "string") {
      continue;
    }
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      continue;
    }
    uniqueTags.add(normalizedTag);
  }
  return [...uniqueTags];
}
function normalizeJournalMetadata(input) {
  return {
    weather: typeof (input == null ? void 0 : input.weather) === "string" ? input.weather.trim() : "",
    location: typeof (input == null ? void 0 : input.location) === "string" ? input.location.trim() : "",
    summary: typeof (input == null ? void 0 : input.summary) === "string" ? input.summary.trim() : "",
    tags: normalizeTagList(input == null ? void 0 : input.tags)
  };
}
function normalizeJournalFrontmatter(input, fallbackTimestamps) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const metadata = normalizeJournalMetadata(input);
  return {
    ...metadata,
    createdAt: typeof (input == null ? void 0 : input.createdAt) === "string" && input.createdAt.trim() ? input.createdAt : (fallbackTimestamps == null ? void 0 : fallbackTimestamps.createdAt) ?? now,
    updatedAt: typeof (input == null ? void 0 : input.updatedAt) === "string" && input.updatedAt.trim() ? input.updatedAt : (fallbackTimestamps == null ? void 0 : fallbackTimestamps.updatedAt) ?? (fallbackTimestamps == null ? void 0 : fallbackTimestamps.createdAt) ?? now
  };
}
function createDefaultFrontmatter() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return normalizeJournalFrontmatter(
    {
      ...EMPTY_METADATA,
      createdAt: now,
      updatedAt: now
    },
    {
      createdAt: now,
      updatedAt: now
    }
  );
}
function normalizeWorkspaceTagLibrary(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      version: 1,
      tags: []
    };
  }
  const value = rawValue;
  return {
    version: 1,
    tags: normalizeTagList(value.tags).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"))
  };
}
function normalizeWorkspaceWeatherLibrary(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      version: 1,
      items: [...DEFAULT_WEATHER_OPTIONS]
    };
  }
  const value = rawValue;
  return {
    version: 1,
    items: normalizeTagList(value.items ?? DEFAULT_WEATHER_OPTIONS).sort(
      (left, right) => left.localeCompare(right, "zh-Hans-CN")
    )
  };
}
function normalizeWorkspaceLocationLibrary(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      version: 1,
      items: []
    };
  }
  const value = rawValue;
  return {
    version: 1,
    items: normalizeTagList(value.items).sort(
      (left, right) => left.localeCompare(right, "zh-Hans-CN")
    )
  };
}
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!match) {
    return {
      frontmatterText: null,
      body: content
    };
  }
  return {
    frontmatterText: match[1],
    body: content.slice(match[0].length)
  };
}
function parseYamlString(rawValue) {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return "";
  }
  if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    try {
      return JSON.parse(trimmedValue);
    } catch {
      return trimmedValue.slice(1, -1);
    }
  }
  if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    return trimmedValue.slice(1, -1).replace(/''/g, "'");
  }
  return trimmedValue;
}
function parseInlineStringArray(rawValue) {
  const trimmedValue = rawValue.trim();
  if (trimmedValue === "[]") {
    return [];
  }
  if (!trimmedValue.startsWith("[") || !trimmedValue.endsWith("]")) {
    return [];
  }
  const innerValue = trimmedValue.slice(1, -1).trim();
  if (!innerValue) {
    return [];
  }
  return innerValue.split(",").map((item) => parseYamlString(item));
}
function parseFrontmatterBlock(frontmatterText) {
  const parsedResult = {};
  let activeListKey = null;
  for (const line of frontmatterText.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const listItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (listItemMatch && activeListKey === "tags") {
      const existingTags = parsedResult.tags ?? [];
      parsedResult.tags = [...existingTags, parseYamlString(listItemMatch[1])];
      continue;
    }
    const keyValueMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!keyValueMatch) {
      activeListKey = null;
      continue;
    }
    const [, key, rawValue = ""] = keyValueMatch;
    activeListKey = null;
    if (key === "tags") {
      if (!rawValue.trim()) {
        parsedResult.tags = [];
        activeListKey = "tags";
        continue;
      }
      parsedResult.tags = parseInlineStringArray(rawValue);
      continue;
    }
    if (key === "createdAt" || key === "updatedAt" || key === "weather" || key === "location" || key === "summary") {
      parsedResult[key] = parseYamlString(rawValue);
    }
  }
  return parsedResult;
}
function stringifyYamlString(value) {
  return JSON.stringify(value);
}
function serializeFrontmatter(frontmatter) {
  const lines = [
    "---",
    `createdAt: ${stringifyYamlString(frontmatter.createdAt)}`,
    `updatedAt: ${stringifyYamlString(frontmatter.updatedAt)}`,
    `weather: ${stringifyYamlString(frontmatter.weather)}`,
    `location: ${stringifyYamlString(frontmatter.location)}`,
    `summary: ${stringifyYamlString(frontmatter.summary)}`
  ];
  if (frontmatter.tags.length === 0) {
    lines.push("tags: []");
  } else {
    lines.push("tags:");
    for (const tag of frontmatter.tags) {
      lines.push(`  - ${stringifyYamlString(tag)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
function serializeJournalDocument(frontmatter, body) {
  const normalizedBody = body.replace(/\r\n/g, "\n");
  return `${serializeFrontmatter(frontmatter)}
${normalizedBody}`;
}
async function readJournalDocument(filePath) {
  const [fileContent, fileStats] = await Promise.all([readFile(filePath, "utf-8"), stat(filePath)]);
  const { frontmatterText, body } = extractFrontmatter(fileContent);
  const parsedFrontmatter = frontmatterText ? parseFrontmatterBlock(frontmatterText) : null;
  return {
    frontmatter: normalizeJournalFrontmatter(parsedFrontmatter, {
      createdAt: fileStats.birthtime.toISOString(),
      updatedAt: fileStats.mtime.toISOString()
    }),
    body
  };
}
async function readJournalDocumentOrDefault(filePath) {
  try {
    return await readJournalDocument(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        frontmatter: createDefaultFrontmatter(),
        body: ""
      };
    }
    throw error;
  }
}
async function writeJournalDocument(filePath, frontmatter, body) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeJournalDocument(frontmatter, body), "utf-8");
}
function countJournalWords(body) {
  const bodyContent = body.trim();
  if (!bodyContent) {
    return 0;
  }
  return bodyContent.replace(/\s+/g, "").length;
}
function getDaysInMonth(monthText) {
  assertValidMonth(monthText);
  const [yearText, monthValueText] = monthText.split("-");
  const year = Number(yearText);
  const monthValue = Number(monthValueText);
  return new Date(year, monthValue, 0).getDate();
}
async function readJournalEntry(input) {
  const filePath = resolveJournalEntryPath(input);
  try {
    const document = await readJournalDocument(filePath);
    return {
      status: "ready",
      filePath,
      frontmatter: document.frontmatter,
      body: document.body
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        status: "missing",
        filePath,
        frontmatter: null,
        body: null
      };
    }
    throw error;
  }
}
async function createJournalEntry(input) {
  const filePath = resolveJournalEntryPath(input);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, serializeJournalDocument(createDefaultFrontmatter(), ""), {
      encoding: "utf-8",
      flag: "wx"
    });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  return readJournalEntry(input);
}
async function saveJournalEntryBody(input) {
  const filePath = resolveJournalEntryPath(input);
  const currentDocument = await readJournalDocumentOrDefault(filePath);
  const savedAt = (/* @__PURE__ */ new Date()).toISOString();
  await writeJournalDocument(
    filePath,
    {
      ...currentDocument.frontmatter,
      updatedAt: savedAt
    },
    input.body
  );
  return {
    filePath,
    savedAt
  };
}
async function saveJournalEntryMetadata(input) {
  const filePath = resolveJournalEntryPath(input);
  const currentDocument = await readJournalDocumentOrDefault(filePath);
  const savedAt = (/* @__PURE__ */ new Date()).toISOString();
  const normalizedMetadata = normalizeJournalMetadata(input.metadata);
  await writeJournalDocument(
    filePath,
    {
      ...currentDocument.frontmatter,
      ...normalizedMetadata,
      updatedAt: savedAt
    },
    currentDocument.body
  );
  await mergeWorkspaceTags(input.workspacePath, normalizedMetadata.tags);
  await mergeWorkspaceWeatherOptions(
    input.workspacePath,
    normalizedMetadata.weather ? [normalizedMetadata.weather] : []
  );
  await mergeWorkspaceLocationOptions(
    input.workspacePath,
    normalizedMetadata.location ? [normalizedMetadata.location] : []
  );
  return {
    filePath,
    savedAt
  };
}
async function getJournalMonthActivity(input) {
  const { workspacePath, month } = input;
  const totalDays = getDaysInMonth(month);
  const [year, monthValue] = month.split("-");
  const days = await Promise.all(
    Array.from({ length: totalDays }, async (_value, index) => {
      const day = String(index + 1).padStart(2, "0");
      const date = `${year}-${monthValue}-${day}`;
      const filePath = resolveJournalEntryFilePath(workspacePath, date);
      try {
        const document = await readJournalDocument(filePath);
        return {
          date,
          hasEntry: true,
          wordCount: countJournalWords(document.body)
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          return {
            date,
            hasEntry: false,
            wordCount: 0
          };
        }
        throw error;
      }
    })
  );
  return {
    month,
    days
  };
}
async function listMarkdownFiles(rootPath) {
  try {
    const directoryEntries = await readdir(rootPath, { withFileTypes: true });
    const nestedResults = await Promise.all(
      directoryEntries.map(async (entry) => {
        const entryPath = path.join(rootPath, entry.name);
        if (entry.isDirectory()) {
          return listMarkdownFiles(entryPath);
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          return [entryPath];
        }
        return [];
      })
    );
    return nestedResults.flat();
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
async function collectWorkspaceTagsFromJournalFiles(workspacePath) {
  const journalRoot = path.join(workspacePath, "journal");
  const filePaths = await listMarkdownFiles(journalRoot);
  const tags = /* @__PURE__ */ new Set();
  for (const filePath of filePaths) {
    try {
      const document = await readJournalDocument(filePath);
      for (const tag of document.frontmatter.tags) {
        tags.add(tag);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}
async function readWorkspaceTagLibrary(workspacePath) {
  const tagLibraryPath = getWorkspaceTagLibraryPath(workspacePath);
  try {
    const fileContent = await readFile(tagLibraryPath, "utf-8");
    return normalizeWorkspaceTagLibrary(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      const initialTags = await collectWorkspaceTagsFromJournalFiles(workspacePath);
      const nextLibrary = normalizeWorkspaceTagLibrary({
        tags: initialTags
      });
      await writeWorkspaceTagLibrary(workspacePath, nextLibrary);
      return nextLibrary;
    }
    throw error;
  }
}
async function writeWorkspaceTagLibrary(workspacePath, library) {
  const metadataDir = getWorkspaceMetadataDir(workspacePath);
  await mkdir(metadataDir, { recursive: true });
  await writeFile(
    getWorkspaceTagLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceTagLibrary(library), null, 2),
    "utf-8"
  );
}
async function mergeWorkspaceTags(workspacePath, tags) {
  const currentLibrary = await readWorkspaceTagLibrary(workspacePath);
  const nextLibrary = normalizeWorkspaceTagLibrary({
    tags: [...currentLibrary.tags, ...tags]
  });
  await writeWorkspaceTagLibrary(workspacePath, nextLibrary);
}
async function getWorkspaceTags(workspacePath) {
  const library = await readWorkspaceTagLibrary(workspacePath);
  return library.tags;
}
async function setWorkspaceTags(input) {
  const nextLibrary = normalizeWorkspaceTagLibrary({
    tags: input.items
  });
  await writeWorkspaceTagLibrary(input.workspacePath, nextLibrary);
  return nextLibrary.tags;
}
async function readWorkspaceWeatherLibrary(workspacePath) {
  const weatherLibraryPath = getWorkspaceWeatherLibraryPath(workspacePath);
  try {
    const fileContent = await readFile(weatherLibraryPath, "utf-8");
    return normalizeWorkspaceWeatherLibrary(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      const nextLibrary = normalizeWorkspaceWeatherLibrary({
        items: DEFAULT_WEATHER_OPTIONS
      });
      await writeWorkspaceWeatherLibrary(workspacePath, nextLibrary);
      return nextLibrary;
    }
    throw error;
  }
}
async function writeWorkspaceWeatherLibrary(workspacePath, library) {
  const metadataDir = getWorkspaceMetadataDir(workspacePath);
  await mkdir(metadataDir, { recursive: true });
  await writeFile(
    getWorkspaceWeatherLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceWeatherLibrary(library), null, 2),
    "utf-8"
  );
}
async function mergeWorkspaceWeatherOptions(workspacePath, items) {
  const currentLibrary = await readWorkspaceWeatherLibrary(workspacePath);
  const nextLibrary = normalizeWorkspaceWeatherLibrary({
    items: [...currentLibrary.items, ...items]
  });
  await writeWorkspaceWeatherLibrary(workspacePath, nextLibrary);
}
async function getWorkspaceWeatherOptions(workspacePath) {
  const library = await readWorkspaceWeatherLibrary(workspacePath);
  return library.items;
}
async function setWorkspaceWeatherOptions(input) {
  const nextLibrary = normalizeWorkspaceWeatherLibrary({
    items: input.items
  });
  await writeWorkspaceWeatherLibrary(input.workspacePath, nextLibrary);
  return nextLibrary.items;
}
async function readWorkspaceLocationLibrary(workspacePath) {
  const locationLibraryPath = getWorkspaceLocationLibraryPath(workspacePath);
  try {
    const fileContent = await readFile(locationLibraryPath, "utf-8");
    return normalizeWorkspaceLocationLibrary(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      const nextLibrary = normalizeWorkspaceLocationLibrary({
        items: []
      });
      await writeWorkspaceLocationLibrary(workspacePath, nextLibrary);
      return nextLibrary;
    }
    throw error;
  }
}
async function writeWorkspaceLocationLibrary(workspacePath, library) {
  const metadataDir = getWorkspaceMetadataDir(workspacePath);
  await mkdir(metadataDir, { recursive: true });
  await writeFile(
    getWorkspaceLocationLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceLocationLibrary(library), null, 2),
    "utf-8"
  );
}
async function mergeWorkspaceLocationOptions(workspacePath, items) {
  const currentLibrary = await readWorkspaceLocationLibrary(workspacePath);
  const nextLibrary = normalizeWorkspaceLocationLibrary({
    items: [...currentLibrary.items, ...items]
  });
  await writeWorkspaceLocationLibrary(workspacePath, nextLibrary);
}
async function getWorkspaceLocationOptions(workspacePath) {
  const library = await readWorkspaceLocationLibrary(workspacePath);
  return library.items;
}
async function setWorkspaceLocationOptions(input) {
  const nextLibrary = normalizeWorkspaceLocationLibrary({
    items: input.items
  });
  await writeWorkspaceLocationLibrary(input.workspacePath, nextLibrary);
  return nextLibrary.items;
}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async () => {
    const config = await readAppConfig();
    return { config };
  });
  ipcMain.handle(
    IPC_CHANNELS.setJournalHeatmapEnabled,
    (_event, input) => {
      return setJournalHeatmapEnabled(input);
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.setFrontmatterVisibility,
    (_event, input) => {
      return setFrontmatterVisibility(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.setWindowDirtyState, (_event, input) => {
    isWindowDirty = input.isDirty;
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
  ipcMain.handle(IPC_CHANNELS.getWorkspaceTags, (_event, workspacePath) => {
    return getWorkspaceTags(workspacePath);
  });
  ipcMain.handle(IPC_CHANNELS.setWorkspaceTags, (_event, input) => {
    return setWorkspaceTags(input);
  });
  ipcMain.handle(IPC_CHANNELS.getWorkspaceWeatherOptions, (_event, workspacePath) => {
    return getWorkspaceWeatherOptions(workspacePath);
  });
  ipcMain.handle(
    IPC_CHANNELS.setWorkspaceWeatherOptions,
    (_event, input) => {
      return setWorkspaceWeatherOptions(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.getWorkspaceLocationOptions, (_event, workspacePath) => {
    return getWorkspaceLocationOptions(workspacePath);
  });
  ipcMain.handle(
    IPC_CHANNELS.setWorkspaceLocationOptions,
    (_event, input) => {
      return setWorkspaceLocationOptions(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.readJournalEntry, (_event, input) => {
    return readJournalEntry(input);
  });
  ipcMain.handle(IPC_CHANNELS.createJournalEntry, (_event, input) => {
    return createJournalEntry(input);
  });
  ipcMain.handle(IPC_CHANNELS.saveJournalEntryBody, (_event, input) => {
    return saveJournalEntryBody(input);
  });
  ipcMain.handle(
    IPC_CHANNELS.saveJournalEntryMetadata,
    (_event, input) => {
      return saveJournalEntryMetadata(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.getJournalMonthActivity, (_event, input) => {
    return getJournalMonthActivity(input);
  });
}
function createWindow() {
  Menu.setApplicationMenu(null);
  isWindowDirty = false;
  isForceClosingWindow = false;
  win = new BrowserWindow({
    width: 1440,
    height: 1e3,
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
  win.on("close", async (event) => {
    if (isForceClosingWindow || !isWindowDirty || !win) {
      return;
    }
    event.preventDefault();
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["仍然关闭", "取消"],
      defaultId: 1,
      cancelId: 1,
      title: "还有未保存内容",
      message: "当前内容还没有保存。",
      detail: "如果现在关闭窗口，未保存的修改将会丢失。",
      noLink: true
    });
    if (response !== 0) {
      return;
    }
    isForceClosingWindow = true;
    win.close();
  });
  win.on("closed", () => {
    isWindowDirty = false;
    isForceClosingWindow = false;
    win = null;
  });
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
