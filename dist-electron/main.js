import { app, safeStorage, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { readFile, mkdir, writeFile, stat, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const APP_ICON_NAME = process.platform === "win32" ? "app.ico" : "app.png";
const APP_ICON_PATH = path.join(process.env.APP_ROOT, "build", "icons", APP_ICON_NAME);
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const IPC_CHANNELS = {
  getBootstrap: "app:get-bootstrap",
  getAiSettingsStatus: "app:get-ai-settings-status",
  saveAiSettings: "app:save-ai-settings",
  saveAiApiKey: "app:save-ai-api-key",
  setJournalHeatmapEnabled: "app:set-journal-heatmap-enabled",
  setDayStartHour: "app:set-day-start-hour",
  setFrontmatterVisibility: "app:set-frontmatter-visibility",
  setWindowDirtyState: "app:set-window-dirty-state",
  openExternalLink: "app:open-external-link",
  openDevTools: "app:open-dev-tools",
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
  getJournalMonthActivity: "journal:get-month-activity",
  generateDailyInsights: "journal:generate-daily-insights"
};
const DEFAULT_AI_SETTINGS = {
  providerType: "openai-compatible",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  timeoutMs: 3e4
};
const DEFAULT_APP_CONFIG = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: "system",
    journalHeatmapEnabled: false,
    dayStartHour: 0,
    frontmatterVisibility: {
      weather: true,
      location: true,
      summary: true,
      tags: true
    }
  },
  ai: DEFAULT_AI_SETTINGS
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
const DEFAULT_LOCATION_OPTIONS = ["学校", "公司", "家"];
const DEFAULT_TAG_OPTIONS = ["上班", "加班", "原神", "杀戮尖塔"];
function getConfigFilePath() {
  return path.join(app.getPath("userData"), "config.json");
}
function normalizeDayStartHour(rawValue) {
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    return 0;
  }
  if (rawValue < 0 || rawValue > 6) {
    return 0;
  }
  return rawValue;
}
function normalizeTimeoutMs(rawValue) {
  return DEFAULT_AI_SETTINGS.timeoutMs;
}
function normalizeBaseURL$1(rawValue, fallbackBaseURL = DEFAULT_AI_SETTINGS.baseURL) {
  if (typeof rawValue !== "string") {
    return fallbackBaseURL;
  }
  const normalizedValue = rawValue.trim().replace(/\/+$/, "");
  return normalizedValue || fallbackBaseURL;
}
function normalizeModel(rawValue, fallbackModel = DEFAULT_AI_SETTINGS.model) {
  if (typeof rawValue !== "string") {
    return fallbackModel;
  }
  const normalizedValue = rawValue.trim();
  return normalizedValue || fallbackModel;
}
function normalizeProviderType(rawValue) {
  return rawValue === "openai" || rawValue === "deepseek" || rawValue === "alibaba" || rawValue === "openai-compatible" ? rawValue : DEFAULT_AI_SETTINGS.providerType;
}
function normalizeAiSettings(rawValue) {
  const providerType = normalizeProviderType(rawValue == null ? void 0 : rawValue.providerType);
  const providerDefaults = getDefaultAiSettings(providerType);
  return {
    providerType,
    baseURL: normalizeBaseURL$1(rawValue == null ? void 0 : rawValue.baseURL, providerDefaults.baseURL),
    model: normalizeModel(rawValue == null ? void 0 : rawValue.model, providerDefaults.model),
    timeoutMs: normalizeTimeoutMs(rawValue == null ? void 0 : rawValue.timeoutMs)
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
function normalizeAppConfig(rawValue) {
  var _a, _b, _c, _d, _e, _f;
  if (!rawValue || typeof rawValue !== "object") {
    return DEFAULT_APP_CONFIG;
  }
  const config = rawValue;
  const recentWorkspaces = Array.isArray(config.recentWorkspaces) ? config.recentWorkspaces.filter((item) => typeof item === "string") : [];
  const theme = ((_a = config.ui) == null ? void 0 : _a.theme) === "light" || ((_b = config.ui) == null ? void 0 : _b.theme) === "dark" || ((_c = config.ui) == null ? void 0 : _c.theme) === "system" ? config.ui.theme : "system";
  const journalHeatmapEnabled = ((_d = config.ui) == null ? void 0 : _d.journalHeatmapEnabled) === true;
  const dayStartHour = normalizeDayStartHour((_e = config.ui) == null ? void 0 : _e.dayStartHour);
  const frontmatterVisibility = normalizeFrontmatterVisibility((_f = config.ui) == null ? void 0 : _f.frontmatterVisibility);
  const ai = normalizeAiSettings(config.ai);
  return {
    lastOpenedWorkspace: typeof config.lastOpenedWorkspace === "string" ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
      journalHeatmapEnabled,
      dayStartHour,
      frontmatterVisibility
    },
    ai
  };
}
async function isExistingDirectory(targetPath) {
  try {
    const targetStat = await stat(targetPath);
    return targetStat.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
async function sanitizeAppConfig(config) {
  const validRecentWorkspaces = [];
  for (const workspacePath of config.recentWorkspaces) {
    if (await isExistingDirectory(workspacePath)) {
      validRecentWorkspaces.push(workspacePath);
    }
  }
  const lastOpenedWorkspace = config.lastOpenedWorkspace && await isExistingDirectory(config.lastOpenedWorkspace) ? config.lastOpenedWorkspace : null;
  const nextRecentWorkspaces = lastOpenedWorkspace && !validRecentWorkspaces.includes(lastOpenedWorkspace) ? [lastOpenedWorkspace, ...validRecentWorkspaces] : validRecentWorkspaces;
  return {
    ...config,
    lastOpenedWorkspace,
    recentWorkspaces: nextRecentWorkspaces
  };
}
async function readAppConfig() {
  try {
    const fileContent = await readFile(getConfigFilePath(), "utf-8");
    const normalizedConfig = normalizeAppConfig(JSON.parse(fileContent));
    return sanitizeAppConfig(normalizedConfig);
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
function getDefaultAiSettings(providerType) {
  switch (providerType) {
    case "openai":
      return {
        providerType,
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs
      };
    case "deepseek":
      return {
        providerType,
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs
      };
    case "alibaba":
      return {
        providerType,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs
      };
    default:
      return {
        ...DEFAULT_AI_SETTINGS
      };
  }
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
async function setDayStartHour(input) {
  const currentConfig = await readAppConfig();
  const nextConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      dayStartHour: normalizeDayStartHour(input.hour)
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
async function setAiSettings(input) {
  const currentConfig = await readAppConfig();
  const nextConfig = {
    ...currentConfig,
    ai: normalizeAiSettings(input)
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
function getSecretsFilePath() {
  return path.join(app.getPath("userData"), "secrets.json");
}
function normalizeSecretsFile(rawValue) {
  var _a, _b, _c, _d, _e;
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }
  const value = rawValue;
  const providerType = ((_a = value.ai) == null ? void 0 : _a.providerType) === "openai" || ((_b = value.ai) == null ? void 0 : _b.providerType) === "deepseek" || ((_c = value.ai) == null ? void 0 : _c.providerType) === "alibaba" || ((_d = value.ai) == null ? void 0 : _d.providerType) === "openai-compatible" ? value.ai.providerType : void 0;
  const encryptedApiKey = typeof ((_e = value.ai) == null ? void 0 : _e.encryptedApiKey) === "string" ? value.ai.encryptedApiKey : void 0;
  return {
    ai: providerType || encryptedApiKey ? {
      providerType,
      encryptedApiKey
    } : void 0
  };
}
async function readSecretsFile() {
  try {
    const fileContent = await readFile(getSecretsFilePath(), "utf-8");
    return normalizeSecretsFile(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}
async function writeSecretsFile(data) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(getSecretsFilePath(), JSON.stringify(data, null, 2), "utf-8");
}
function ensureSafeStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("当前系统环境暂不支持安全加密存储 API Key。");
  }
}
async function hasAiApiKey(providerType) {
  var _a;
  const secrets = await readSecretsFile();
  return Boolean(
    ((_a = secrets.ai) == null ? void 0 : _a.providerType) === providerType && typeof secrets.ai.encryptedApiKey === "string" && secrets.ai.encryptedApiKey.trim()
  );
}
async function readAiApiKey(providerType) {
  var _a;
  const secrets = await readSecretsFile();
  if (((_a = secrets.ai) == null ? void 0 : _a.providerType) !== providerType || !secrets.ai.encryptedApiKey || !secrets.ai.encryptedApiKey.trim()) {
    return null;
  }
  ensureSafeStorageAvailable();
  try {
    return safeStorage.decryptString(Buffer.from(secrets.ai.encryptedApiKey, "base64"));
  } catch {
    throw new Error("读取大模型 API Key 失败，密钥可能已损坏，请重新保存。");
  }
}
async function saveAiApiKey(input) {
  const apiKey = input.apiKey.trim();
  if (apiKey) {
    ensureSafeStorageAvailable();
    await writeSecretsFile({
      ai: {
        providerType: input.providerType,
        encryptedApiKey: safeStorage.encryptString(apiKey).toString("base64")
      }
    });
  } else {
    await writeSecretsFile({
      ai: {
        providerType: input.providerType
      }
    });
  }
  const config = await readAppConfig();
  const hasApiKey = await hasAiApiKey(config.ai.providerType);
  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey)
  };
}
async function getAiSettingsStatus() {
  const config = await readAppConfig();
  const hasApiKey = await hasAiApiKey(config.ai.providerType);
  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey)
  };
}
async function saveAiSettings(input) {
  const config = await setAiSettings(input);
  const hasApiKey = await hasAiApiKey(config.ai.providerType);
  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey)
  };
}
const PROMPT_FILE_MAP = {
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YCDkuI4gYHRhZ3Ng44CCCgrkvaDnmoTku7vliqHvvJoKMS4gYHN1bW1hcnlgCiAgIOagueaNruaXpeiusOato+aWh+eUn+aIkOS4gOWPpeivneaAu+e7k++8jOeUqOS6juWGmeWFpSBmcm9udG1hdHRlcuOAggoyLiBgdGFnc2AKICAg55Sf5oiQIDMg5YiwIDYg5Liq5qCH562+77yM55So5LqO6ZW/5pyf5b2S5qGj44CB5pCc57Si5ZKM5Zue6aG+44CCCgrlhYjmiafooYzor63oqIDliKTmlq3vvIzlho3nlJ/miJDnu5PmnpzvvJoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKLSDkvJjlhYjlpI3nlKjigJzlvZPliY3lt6XkvZzljLrlt7LmnInmoIfnrb7igJ3kuK3or63kuYnlh4bnoa7jgIHkuJTor63oqIDpo47moLzkuI7mnKzmrKHovpPlh7rkuIDoh7TnmoTmoIfnrb7jgIIKLSDlj6rmnInlnKjlt7LmnInmoIfnrb7mmI7mmL7kuI3otrPku6Xooajovr7mraPmlofph43ngrnml7bvvIzmiY3mlrDlop7moIfnrb7jgIIKLSDlpoLmnpzlt7LmnInmoIfnrb7kuI7mraPmlofkuLvor63oqIDkuI3kuIDoh7TvvIzkuI3opoHkuLrkuoblpI3nlKjogIzlvLrooYzkvb/nlKjlj6bkuIDnp43or63oqIDnmoTmoIfnrb7jgIIKLSDmoIfnrb7lupTkvJjlhYjmpoLmi6zigJzkuLvpopjjgIHkuovku7bjgIHnirbmgIHjgIHlnLrmma/jgIHku7vliqHjgIHlhbPns7vjgIHlnLDngrnjgIHmg4Xnu6rjgIHpmLbmrrXmgKfpl67popjigJ3nrYnplb/mnJ/lj6/mo4DntKLkv6Hmga/jgIIKLSDmoIfnrb7opoHnroDmtIHjgIHnqLPlrprjgIHlj6/lpI3nlKjvvIzpgb/lhY3kuIDmrKHmgKflj6PlpLTooajovr7jgIIKLSDmoIfnrb7lupTlsL3ph4/mmK/nn63or63miJbor43or63vvIzkuI3opoHlhpnmiJDplb/lj6XjgIIKLSDkuI3opoHovpPlh7rlvbzmraTlh6DkuY7lkIzkuYnjgIHlj6rmmK/ovbvlvq7mjaLlhpnms5XnmoTmoIfnrb7jgIIKLSDkuI3opoHovpPlh7rov4fluqblrr3ms5vjgIHlh6DkuY7lr7nku7vkvZXml6XorrDpg73pgILnlKjnmoTnqbrms5vmoIfnrb7vvIzkvovlpoLigJznlJ/mtLvigJ3igJzorrDlvZXigJ3igJzmg7Pms5XigJ3igJzml6XorrDigJ3jgIIKLSDkuI3opoHmiormgLvnu5Plj6Xmi4bmiJDmoIfnrb7vvIzkuZ/kuI3opoHmnLrmorDmir3lj5bmraPmlofkuK3nmoTmr4/kuKrlkI3or43jgIIKLSDoi7HmlofmoIfnrb7kvJjlhYjkvb/nlKjoh6rnhLbjgIHnroDmtIHnmoQgbG93ZXJjYXNlIOivjeaIluefreivre+8m+mZpOmdnuS4k+acieWQjeivjeacrOi6q+mcgOimgeS/neeVmeWkp+Wwj+WGmeOAggoKYHN1bW1hcnlgIOeUn+aIkOinhOWIme+8mgotIGBzdW1tYXJ5YCDlv4XpobvmmK/kuIDlj6Xor53vvIzkuI3opoHlhpnmiJDmoIfpopjvvIzkuI3opoHliIbngrnvvIzkuI3opoHliqDlvJXlj7fjgIIKLSDor63msJTkv53mjIHlubPlrp7jgIHlhYvliLbjgIHotLTov5Hml6XorrDlvZLmoaPvvIzkuI3opoHlpLjlvKDvvIzkuI3opoHpuKHmsaTvvIzkuI3opoHor4TorrrnlKjmiLfjgIIKLSDkuK3mlofmgLvnu5PmjqfliLblnKjnuqYgMjAg5YiwIDQwIOS4quaxieWtl+OAggotIOiLseaWh+aAu+e7k+aOp+WItuWcqOe6piAxMiDliLAgMjQg5Liq5Y2V6K+N44CCCi0g5oC757uT5bqU5qaC5ous5b2T5aSp5pyA5Li76KaB55qE5LqL5Lu244CB54q25oCB5oiW5o6o6L+b77yM5LiN6KaB5aCG56CM57uG6IqC44CCCi0g6Iul5q2j5paH6YeN54K55piO56Gu77yM5bqU5LyY5YWI5L+d55WZ5pyA5qC45b+D55qEIDEg5YiwIDIg5Liq5L+h5oGv54K544CCCi0g6Iul5q2j5paH6L6D6Zu25pWj77yM5bqU5o+Q54K85YWx5ZCM5Li757q/77yM6ICM5LiN5piv6YCQ5p2h572X5YiX44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKLSDlj6rog73kvp3mja7nlKjmiLfmj5DkvpvnmoTmraPmloflkozlt7LmnInmoIfnrb7ov5vooYzmlbTnkIbjgIIKLSDkuI3opoHnvJbpgKDmraPmlofkuK3msqHmnInlh7rnjrDnmoTph43opoHkuovlrp7jgIHkurrnianlhbPns7vjgIHlnLDngrnjgIHorqHliJLjgIHmg4Xnu6rmiJbnu5PorrrjgIIKLSDkuI3opoHmiormjqjmtYvlvZPmiJDkuovlrp7vvJvlpoLmnpzmraPmlofmsqHmnInmmI7noa7or7TmmI7vvIzlsLHkuI3opoHooaXlhYXjgIIKLSDkuI3opoHmm7/nlKjmiLflgZrku7flgLzliKTmlq3jgIHlv4PnkIbor4rmlq3miJblu7rorq7jgIIKLSDkuI3opoHmmrTpnLLkvaDnmoTliIbmnpDov4fnqIvvvIzkuI3opoHop6Pph4rkuLrku4DkuYjov5nmoLfnlJ/miJDjgIIKLSDkuI3opoHovpPlh7rku7vkvZUgSlNPTiDku6XlpJbnmoTlhoXlrrnjgIIKCui+ueeVjOWkhOeQhu+8mgotIOWNs+S9v+ato+aWh+WGheWuueeugOefreOAgembtuaVo++8jOS5n+imgeWwvemHj+e7meWHuuS4gOS4quWPr+eUqOeahOaAu+e7k+WSjCAzIOWIsCA4IOS4quagh+etvuOAggotIOWmguaenOato+aWh+S4reWMheWQq+W+heWKnuOAgeaDhee7quOAgeW3peS9nOOAgeeUn+a0u+eJh+auteetieWkmuexu+WGheWuue+8jOS8mOWFiOaPkOeCvOW9k+WkqeacgOmHjeimgeeahOS4u+e6v++8jOWGjeeUqOagh+etvuihpeWFheasoeimgee7tOW6puOAggotIOWmguaenOato+aWh+S4u+imgeaYr+iLseaWh++8jOS9huWkueadguWwkemHj+S4reaWh+S4k+acieivje+8jOWPr+WcqOiLseaWh+aAu+e7k+S4reS/neeVmeW/heimgeS4k+acieWQjeivjeWOn+aWh+OAggotIOWmguaenOato+aWh+S4u+imgeaYr+S4reaWh++8jOS9huWkueadguWwkemHj+iLseaWh+acr+ivre+8jOWPr+WcqOS4reaWh+aAu+e7k+S4reS/neeVmeW/heimgeacr+ivreWOn+aWh+OAggoK6L6T5Ye657qm5p2f77yaCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXX1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB6L6T5Ye6IGBudWxsYOOAgeWvueixoeOAgeaVsOWtl+OAgeW4g+WwlOWAvOaIlumineWkluWtl+auteOAggo=", import.meta.url)
};
const promptCache = /* @__PURE__ */ new Map();
async function loadPrompt(name) {
  const cachedPrompt = promptCache.get(name);
  if (cachedPrompt) {
    return cachedPrompt;
  }
  const promptUrl = PROMPT_FILE_MAP[name];
  let promptText = "";
  if (promptUrl.protocol === "file:") {
    promptText = await readFile(fileURLToPath(promptUrl), "utf-8");
  } else if (promptUrl.protocol === "data:") {
    const response = await fetch(promptUrl);
    promptText = await response.text();
  } else {
    throw new Error(`暂不支持读取 ${promptUrl.protocol} 协议的提示词文件。`);
  }
  promptCache.set(name, promptText);
  return promptText;
}
function normalizeBaseURL(baseURL) {
  return baseURL.trim().replace(/\/+$/, "");
}
function resolveEndpoint(baseURL) {
  return `${normalizeBaseURL(baseURL)}/chat/completions`;
}
function extractResponseText(response) {
  var _a, _b, _c;
  const content = (_c = (_b = (_a = response.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => item.type === "text" && typeof item.text === "string" ? item.text : "").join("");
  }
  return "";
}
function createAiChatClient(settings, apiKey) {
  const supportsJsonMode = settings.providerType === "openai" || settings.providerType === "openai-compatible";
  return {
    async completeJson(input) {
      var _a;
      const response = await fetch(resolveEndpoint(settings.baseURL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.2,
          ...supportsJsonMode ? { response_format: { type: "json_object" } } : {},
          messages: input.messages
        }),
        signal: AbortSignal.timeout(settings.timeoutMs)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(((_a = payload == null ? void 0 : payload.error) == null ? void 0 : _a.message) || `AI 请求失败（${response.status}）。`);
      }
      const content = payload ? extractResponseText(payload) : "";
      if (!content.trim()) {
        throw new Error("AI 没有返回可用内容，请稍后重试。");
      }
      return content;
    }
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
function getWorkspaceJournalDir(workspacePath) {
  return path.join(workspacePath, "journal");
}
function normalizeStringList(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  const uniqueItems = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const normalizedItem = item.trim();
    if (!normalizedItem) {
      continue;
    }
    uniqueItems.add(normalizedItem);
  }
  return [...uniqueItems];
}
function normalizeJournalMetadata(input) {
  return {
    weather: typeof (input == null ? void 0 : input.weather) === "string" ? input.weather.trim() : "",
    location: typeof (input == null ? void 0 : input.location) === "string" ? input.location.trim() : "",
    summary: typeof (input == null ? void 0 : input.summary) === "string" ? input.summary.trim() : "",
    tags: normalizeStringList(input == null ? void 0 : input.tags)
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
function extractJsonObject(text) {
  const trimmedText = text.trim();
  try {
    return JSON.parse(trimmedText);
  } catch {
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("大模型返回内容不是有效的结构化结果。");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
function createWorkspaceTagMap(workspaceTags) {
  const tagMap = /* @__PURE__ */ new Map();
  for (const tag of normalizeStringList(workspaceTags)) {
    tagMap.set(tag.toLocaleLowerCase(), tag);
  }
  return tagMap;
}
function normalizeDailyInsights(payload, workspaceTags) {
  const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
  if (!summary) {
    throw new Error("大模型返回的总结为空，请稍后重试。");
  }
  const workspaceTagMap = createWorkspaceTagMap(workspaceTags);
  const normalizedTags = normalizeStringList(Array.isArray(payload.tags) ? payload.tags : []).map(
    (tag) => workspaceTagMap.get(tag.toLocaleLowerCase()) ?? tag
  );
  const dedupedTags = [...new Set(normalizedTags)].slice(0, 8);
  if (dedupedTags.length < 3) {
    throw new Error("大模型返回的标签数量不足，暂时无法完成自动整理。");
  }
  const existingTags = dedupedTags.filter((tag) => workspaceTagMap.has(tag.toLocaleLowerCase()));
  const newTags = dedupedTags.filter((tag) => !workspaceTagMap.has(tag.toLocaleLowerCase()));
  return {
    summary,
    tags: dedupedTags,
    existingTags,
    newTags
  };
}
function buildDailyInsightsPrompt(input) {
  const body = input.body.trim();
  if (!body) {
    throw new Error("正文为空，暂时无法自动整理。");
  }
  const workspaceTags = input.workspaceTags.length > 0 ? input.workspaceTags.join("、") : "当前工作区还没有既有标签";
  return [
    `业务日期：${input.date}`,
    `当前工作区已有标签：${workspaceTags}`,
    "当日日记正文：",
    body
  ].join("\n\n");
}
function ensureAiSettingsReady(config) {
  const settings = normalizeAiSettings(config.ai);
  if (!settings.baseURL) {
    throw new Error("请先在设置页填写大模型接口地址。");
  }
  if (!settings.model) {
    throw new Error("请先在设置页填写大模型模型名称。");
  }
  return settings;
}
async function generateDailyInsights(input) {
  assertValidDate(input.date);
  if (!input.workspacePath.trim()) {
    throw new Error("当前还没有可用的工作区。");
  }
  if (!input.body.trim()) {
    throw new Error("正文为空，暂时无法自动整理。");
  }
  const [config, systemPrompt] = await Promise.all([readAppConfig(), loadPrompt("dailyOrganizeSystem")]);
  const settings = ensureAiSettingsReady(config);
  const apiKey = await readAiApiKey(settings.providerType);
  if (!apiKey) {
    throw new Error("请先在设置页保存当前 provider 的 API Key。");
  }
  const client = createAiChatClient(settings, apiKey);
  const responseText = await client.completeJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildDailyInsightsPrompt(input) }
    ]
  });
  return normalizeDailyInsights(extractJsonObject(responseText), input.workspaceTags);
}
function sortChinese(items) {
  return [...items].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}
function normalizeWorkspaceTagLibrary(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      version: 1,
      tags: [...DEFAULT_TAG_OPTIONS]
    };
  }
  const value = rawValue;
  return {
    version: 1,
    tags: sortChinese(normalizeStringList(value.tags))
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
    items: sortChinese(normalizeStringList(value.items ?? DEFAULT_WEATHER_OPTIONS))
  };
}
function normalizeWorkspaceLocationLibrary(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      version: 1,
      items: [...DEFAULT_LOCATION_OPTIONS]
    };
  }
  const value = rawValue;
  return {
    version: 1,
    items: sortChinese(normalizeStringList(value.items))
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
  const journalRoot = getWorkspaceJournalDir(workspacePath);
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
  return sortChinese([...tags]);
}
async function ensureWorkspaceMetadataDir(workspacePath) {
  await mkdir(getWorkspaceMetadataDir(workspacePath), { recursive: true });
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
        tags: [...DEFAULT_TAG_OPTIONS, ...initialTags]
      });
      await writeWorkspaceTagLibrary(workspacePath, nextLibrary);
      return nextLibrary;
    }
    throw error;
  }
}
async function writeWorkspaceTagLibrary(workspacePath, library) {
  await ensureWorkspaceMetadataDir(workspacePath);
  await writeFile(
    getWorkspaceTagLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceTagLibrary(library), null, 2),
    "utf-8"
  );
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
  await ensureWorkspaceMetadataDir(workspacePath);
  await writeFile(
    getWorkspaceWeatherLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceWeatherLibrary(library), null, 2),
    "utf-8"
  );
}
async function readWorkspaceLocationLibrary(workspacePath) {
  const locationLibraryPath = getWorkspaceLocationLibraryPath(workspacePath);
  try {
    const fileContent = await readFile(locationLibraryPath, "utf-8");
    return normalizeWorkspaceLocationLibrary(JSON.parse(fileContent));
  } catch (error) {
    if (error.code === "ENOENT") {
      const nextLibrary = normalizeWorkspaceLocationLibrary({
        items: DEFAULT_LOCATION_OPTIONS
      });
      await writeWorkspaceLocationLibrary(workspacePath, nextLibrary);
      return nextLibrary;
    }
    throw error;
  }
}
async function writeWorkspaceLocationLibrary(workspacePath, library) {
  await ensureWorkspaceMetadataDir(workspacePath);
  await writeFile(
    getWorkspaceLocationLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceLocationLibrary(library), null, 2),
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
async function mergeWorkspaceWeatherOptions(workspacePath, items) {
  const currentLibrary = await readWorkspaceWeatherLibrary(workspacePath);
  const nextLibrary = normalizeWorkspaceWeatherLibrary({
    items: [...currentLibrary.items, ...items]
  });
  await writeWorkspaceWeatherLibrary(workspacePath, nextLibrary);
}
async function mergeWorkspaceLocationOptions(workspacePath, items) {
  const currentLibrary = await readWorkspaceLocationLibrary(workspacePath);
  const nextLibrary = normalizeWorkspaceLocationLibrary({
    items: [...currentLibrary.items, ...items]
  });
  await writeWorkspaceLocationLibrary(workspacePath, nextLibrary);
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
  const frontmatter = createDefaultFrontmatter();
  try {
    await writeFile(filePath, serializeJournalDocument(frontmatter, ""), {
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
let win = null;
let isWindowDirty = false;
let isForceClosingWindow = false;
function getMainWindow() {
  return win;
}
function setWindowDirtyState(isDirty) {
  isWindowDirty = isDirty;
}
function openMainWindowDevTools() {
  if (!win) {
    return;
  }
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.focus();
    return;
  }
  win.webContents.openDevTools({ mode: "detach" });
}
function createMainWindow() {
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
      preload: path.join(MAIN_DIST, "preload.mjs")
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
function registerWindowLifecycleEvents() {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
      win = null;
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async () => {
    const config = await readAppConfig();
    return { config };
  });
  ipcMain.handle(IPC_CHANNELS.getAiSettingsStatus, () => {
    return getAiSettingsStatus();
  });
  ipcMain.handle(IPC_CHANNELS.saveAiSettings, (_event, input) => {
    return saveAiSettings(input);
  });
  ipcMain.handle(IPC_CHANNELS.saveAiApiKey, (_event, input) => {
    return saveAiApiKey(input);
  });
  ipcMain.handle(
    IPC_CHANNELS.setJournalHeatmapEnabled,
    (_event, input) => {
      return setJournalHeatmapEnabled(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.setDayStartHour, (_event, input) => {
    return setDayStartHour(input);
  });
  ipcMain.handle(
    IPC_CHANNELS.setFrontmatterVisibility,
    (_event, input) => {
      return setFrontmatterVisibility(input);
    }
  );
  ipcMain.handle(IPC_CHANNELS.setWindowDirtyState, (_event, input) => {
    setWindowDirtyState(input.isDirty);
  });
  ipcMain.handle(IPC_CHANNELS.openExternalLink, async (_event, input) => {
    const url = input.url.trim();
    if (!/^https:\/\/.+/i.test(url) && !/^mailto:.+/i.test(url)) {
      throw new Error("暂不支持打开这个地址。");
    }
    await shell.openExternal(url);
  });
  ipcMain.handle(IPC_CHANNELS.openDevTools, () => {
    openMainWindowDevTools();
  });
  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async () => {
    const currentConfig = await readAppConfig();
    const dialogOptions = {
      title: "选择日记目录",
      buttonLabel: "选择这个目录",
      properties: ["openDirectory"]
    };
    const win2 = getMainWindow();
    const result = win2 ? await dialog.showOpenDialog(win2, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
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
  ipcMain.handle(IPC_CHANNELS.generateDailyInsights, (_event, input) => {
    return generateDailyInsights(input);
  });
}
registerWindowLifecycleEvents();
app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
});
