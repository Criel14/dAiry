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
  generateDailyInsights: "journal:generate-daily-insights",
  generateRangeReport: "report:generate-range-report",
  getRangeReport: "report:get-range-report",
  listRangeReports: "report:list-range-reports"
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
      mood: true,
      summary: true,
      tags: true
    }
  },
  ai: DEFAULT_AI_SETTINGS
};
const EMPTY_METADATA = {
  weather: "",
  location: "",
  mood: 0,
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
    mood: (rawValue == null ? void 0 : rawValue.mood) !== false,
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
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YOOAgWB0YWdzYCDkuI4gYG1vb2Rg44CCCgrkvaDnmoTku7vliqHvvJoKCjEuIGBzdW1tYXJ5YAogICDmoLnmja7ml6XorrDmraPmlofnlJ/miJDkuIDlj6Xor53mgLvnu5PvvIznlKjkuo7lhpnlhaUgZnJvbnRtYXR0ZXLjgIIKMi4gYHRhZ3NgCiAgIOeUn+aIkCAzIOWIsCA2IOS4quagh+etvu+8jOeUqOS6jumVv+acn+W9kuaho+OAgeaQnOe0ouWSjOWbnumhvuOAggozLiBgbW9vZGAKICAg5qC55o2u5q2j5paH5Yik5pat5L2c6ICF5b2T5aSp5pW05L2T5oOF57uq5YC+5ZCR77yM6L6T5Ye65LiA5LiqIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKCuWFiOaJp+ihjOivreiogOWIpOaWre+8jOWGjeeUn+aIkOe7k+aenO+8mgoKLSDlhYjliKTmlq3ml6XorrDmraPmlofnmoTkuLvor63oqIDjgIIKLSDlpoLmnpzmraPmlofku6XkuK3mlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjkuK3mlofjgIIKLSDlpoLmnpzmraPmlofku6Xoi7HmlofkuLrkuLvvvIxgc3VtbWFyeWAg5ZKM5paw5aKeIGB0YWdzYCDkvb/nlKjoi7HmlofjgIIKLSDlpoLmnpzmraPmlofkuK3kuK3oi7Hmt7flkIjvvIzmjInkv6Hmga/ph4/mm7TlpJrjgIHlj6XlrZDljaDmr5Tmm7Tpq5jjgIHlj5nov7DkuLvkvZPmm7TmmI7mmL7nmoTor63oqIDkvZzkuLrkuLvor63oqIDjgIIKLSDovpPlh7rml7bkuI3opoHlnKjkuK3oi7HmlofkuYvpl7TmnaXlm57liIfmjaLvvJtgc3VtbWFyeWAg5b+F6aG75Y+q5L2/55So5LiA56eN5Li76K+t6KiA44CCCi0g5qCH562+5Lmf5bqU5bC96YeP5L+d5oyB5Y2V5LiA6K+t6KiA6aOO5qC877yM5LiN6KaB5ZCM5pe26L6T5Ye65LiA57uE5Lit5paH5qCH562+5ZKM5LiA57uE6Iux5paH5qCH562+44CCCgrmoIfnrb7nlJ/miJDop4TliJnvvJoKCi0g5LyY5YWI5aSN55So4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd5Lit6K+t5LmJ5YeG56Gu44CB5LiU6K+t6KiA6aOO5qC85LiO5pys5qyh6L6T5Ye65LiA6Ie055qE5qCH562+44CCCi0g5Y+q5pyJ5Zyo5bey5pyJ5qCH562+5piO5pi+5LiN6Laz5Lul6KGo6L6+5q2j5paH6YeN54K55pe277yM5omN5paw5aKe5qCH562+44CCCi0g5aaC5p6c5bey5pyJ5qCH562+5LiO5q2j5paH5Li76K+t6KiA5LiN5LiA6Ie077yM5LiN6KaB5Li65LqG5aSN55So6ICM5by66KGM5L2/55So5Y+m5LiA56eN6K+t6KiA55qE5qCH562+44CCCi0g5qCH562+5bqU5LyY5YWI5qaC5ous4oCc5Li76aKY44CB5LqL5Lu244CB54q25oCB44CB5Zy65pmv44CB5Lu75Yqh44CB5YWz57O744CB5Zyw54K544CB5oOF57uq44CB6Zi25q615oCn6Zeu6aKY4oCd562J6ZW/5pyf5Y+v5qOA57Si5L+h5oGv44CCCi0g5qCH562+6KaB566A5rSB44CB56iz5a6a44CB5Y+v5aSN55So77yM6YG/5YWN5LiA5qyh5oCn5Y+j5aS06KGo6L6+44CCCi0g5qCH562+5bqU5bC96YeP5piv55+t6K+t5oiW6K+N6K+t77yM5LiN6KaB5YaZ5oiQ6ZW/5Y+l44CCCi0g5LiN6KaB6L6T5Ye65b285q2k5Yeg5LmO5ZCM5LmJ44CB5Y+q5piv6L275b6u5o2i5YaZ5rOV55qE5qCH562+44CCCi0g5LiN6KaB6L6T5Ye66L+H5bqm5a695rOb44CB5Yeg5LmO5a+55Lu75L2V5pel6K6w6YO96YCC55So55qE56m65rOb5qCH562+77yM5L6L5aaC4oCc55Sf5rS74oCd4oCc6K6w5b2V4oCd4oCc5oOz5rOV4oCd4oCc5pel6K6w4oCd44CCCi0g5LiN6KaB5oqK5oC757uT5Y+l5ouG5oiQ5qCH562+77yM5Lmf5LiN6KaB5py65qKw5oq95Y+W5q2j5paH5Lit55qE5q+P5Liq5ZCN6K+N44CCCi0g6Iux5paH5qCH562+5LyY5YWI5L2/55So6Ieq54S244CB566A5rSB55qEIGxvd2VyY2FzZSDor43miJbnn63or63vvJvpmaTpnZ7kuJPmnInlkI3or43mnKzouqvpnIDopoHkv53nlZnlpKflsI/lhpnjgIIKCmBzdW1tYXJ5YCDnlJ/miJDop4TliJnvvJoKCi0gYHN1bW1hcnlgIOW/hemhu+aYr+S4gOWPpeivne+8jOS4jeimgeWGmeaIkOagh+mimO+8jOS4jeimgeWIhueCue+8jOS4jeimgeWKoOW8leWPt+OAggotIOivreawlOS/neaMgeW5s+WunuOAgeWFi+WItuOAgei0tOi/keaXpeiusOW9kuaho++8jOS4jeimgeWkuOW8oO+8jOS4jeimgem4oeaxpO+8jOS4jeimgeivhOiuuueUqOaIt+OAggotIOS4reaWh+aAu+e7k+aOp+WItuWcqOe6piAyMCDliLAgNDAg5Liq5rGJ5a2X44CCCi0g6Iux5paH5oC757uT5o6n5Yi25Zyo57qmIDEyIOWIsCAyNCDkuKrljZXor43jgIIKLSDmgLvnu5PlupTmpoLmi6zlvZPlpKnmnIDkuLvopoHnmoTkuovku7bjgIHnirbmgIHmiJbmjqjov5vvvIzkuI3opoHloIbnoIznu4boioLjgIIKLSDoi6XmraPmlofph43ngrnmmI7noa7vvIzlupTkvJjlhYjkv53nlZnmnIDmoLjlv4PnmoQgMSDliLAgMiDkuKrkv6Hmga/ngrnjgIIKLSDoi6XmraPmlofovoPpm7bmlaPvvIzlupTmj5DngrzlhbHlkIzkuLvnur/vvIzogIzkuI3mmK/pgJDmnaHnvZfliJfjgIIKCmBtb29kYCDliKTmlq3op4TliJnvvJoKCi0gYG1vb2RgIOihqOekuuS9nOiAheWcqOi/meevh+aXpeiusOS4reWRiOeOsOWHuueahOaVtOS9k+aDhee7quWAvuWQke+8jOS4jeihqOekuuWuouinguS6i+S7tuacrOi6q+eahOWlveWdj+OAggotIOS8mOWFiOS+neaNruato+aWh+S4reaYjuehruihqOi+vueahOaDhee7quOAgeivreawlOOAgeivhOS7t+WSjOaVtOS9k+iQveeCueWIpOaWre+8jOS4jeimgeWPquagueaNruWNleS4quS6i+S7tuacuuaisOaJk+WIhuOAggotIOWmguaenOWGheWuueWQjOaXtuWHuueOsOato+i0n+S4pOexu+aDhee7qu+8jOS8mOWFiOeci+evh+W5heWNoOavlOOAgeWPjeWkjeW8uuiwg+eahOmDqOWIhuOAgee7k+WwvuivreawlOWSjOaVtOS9k+S4u+e6v+OAggotIOW/meOAgee0r+OAgeW5s+a3oeOAgeWFi+WItuS4jeiHquWKqOetieS6jui0n+mdou+8m+mhuuWIqeOAgeWujOaIkOS7u+WKoeS5n+S4jeiHquWKqOetieS6juW8uuato+mdouOAggotIOWmguaenOato+aWh+WHoOS5juayoeacieaYjuaYvuaDhee7que6v+e0ou+8jOm7mOiupOi/lOWbniBgMGDvvIzooajnpLrmlbTkvZPlubPnqLPmiJbkuK3mgKfjgIIKLSDlj6rlhYHorrjovpPlh7rmlbTmlbDvvIzkuI3opoHovpPlh7rlsI/mlbDjgIIKLSDliIblgLzor63kuYnlpoLkuIvvvJoKLSBgLTVgIOW8uueDiOi0n+mdou+8jOaYjuaYvuW0qea6g+OAgee7neacm+aIluW8uueXm+iLpuOAggotIGAtNGAg5b6I5beu77yM5oyB57ut5L2O6JC95oiW5piO5pi+5Y+X5oyr44CCCi0gYC0zYCDmmI7mmL7otJ/pnaLvvIzmsq7kuKfjgIHng6bouoHjgIHljovmipHljaDkuLvlr7zjgIIKLSBgLTJgIOi9u+S4reW6pui0n+mdou+8jOS4jeiIkuacjeS9hui/mOacquWIsOS4pemHjeeoi+W6puOAggotIGAtMWAg55Wl6LSf6Z2i77yM5pyJ5LiN6aG65oiW6L275b6u5L2O5rCU5Y6L44CCCi0gYDBgIOW5s+eos+OAgeS4reaAp+OAgeWkjeadguaDhee7quWkp+S9k+aKtea2iO+8jOaIluihqOi+vuWFi+WItuiAjOaXoOaYjuaYvuWAvuWQkeOAggotIGAxYCDnlaXmraPpnaLvvIzmnInkuIDngrnovbvmnb7jgIHmu6HmhI/miJbmnJ/lvoXjgIIKLSBgMmAg5q+U6L6D5q2j6Z2i77yM5b2T5aSp5pW05L2T54q25oCB5LiN6ZSZ44CCCi0gYDNgIOaYjuaYvuato+mdou+8jOW8gOW/g+OAgeWFheWunuOAgemhuueVheWNoOS4u+WvvOOAggotIGA0YCDlvojlpb3vvIzlhbTlpYvmiJbmu6HotrPmhJ/ovoPlvLrjgIIKLSBgNWAg5by654OI5q2j6Z2i77yM5bCR6KeB55qE6auY5bOw5L2T6aqM44CCCgrkuovlrp7kuI7lronlhajnuqbmnZ/vvJoKCi0g5Y+q6IO95L6d5o2u55So5oi35o+Q5L6b55qE5q2j5paH5ZKM5bey5pyJ5qCH562+6L+b6KGM5pW055CG44CCCi0g5LiN6KaB57yW6YCg5q2j5paH5Lit5rKh5pyJ5Ye6546w55qE6YeN6KaB5LqL5a6e44CB5Lq654mp5YWz57O744CB5Zyw54K544CB6K6h5YiS44CB5oOF57uq5oiW57uT6K6644CCCi0g5LiN6KaB5oqK5o6o5rWL5b2T5oiQ5LqL5a6e77yb5aaC5p6c5q2j5paH5rKh5pyJ5piO56Gu6K+05piO77yM5bCx5LiN6KaB6KGl5YWF44CCCi0g5LiN6KaB5pu/55So5oi35YGa5Lu35YC85Yik5pat44CB5b+D55CG6K+K5pat5oiW5bu66K6u44CCCi0g5LiN6KaB5pq06Zyy5L2g55qE5YiG5p6Q6L+H56iL77yM5LiN6KaB6Kej6YeK5Li65LuA5LmI6L+Z5qC355Sf5oiQ44CCCi0g5LiN6KaB6L6T5Ye65Lu75L2VIEpTT04g5Lul5aSW55qE5YaF5a6544CCCgrovrnnlYzlpITnkIbvvJoKCi0g5Y2z5L2/5q2j5paH5YaF5a65566A55+t44CB6Zu25pWj77yM5Lmf6KaB5bC96YeP57uZ5Ye65LiA5Liq5Y+v55So55qE5oC757uT5ZKMIDMg5YiwIDgg5Liq5qCH562+44CCCi0g5aaC5p6c5q2j5paH5Lit5YyF5ZCr5b6F5Yqe44CB5oOF57uq44CB5bel5L2c44CB55Sf5rS754mH5q61562J5aSa57G75YaF5a6577yM5LyY5YWI5o+Q54K85b2T5aSp5pyA6YeN6KaB55qE5Li757q/77yM5YaN55So5qCH562+6KGl5YWF5qyh6KaB57u05bqm44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv6Iux5paH77yM5L2G5aS55p2C5bCR6YeP5Lit5paH5LiT5pyJ6K+N77yM5Y+v5Zyo6Iux5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5LiT5pyJ5ZCN6K+N5Y6f5paH44CCCi0g5aaC5p6c5q2j5paH5Li76KaB5piv5Lit5paH77yM5L2G5aS55p2C5bCR6YeP6Iux5paH5pyv6K+t77yM5Y+v5Zyo5Lit5paH5oC757uT5Lit5L+d55WZ5b+F6KaB5pyv6K+t5Y6f5paH44CCCgrovpPlh7rnuqbmnZ/vvJoKCi0g5Y+q6L+U5Zue5LiA5LiqIEpTT04g5a+56LGh77yM5LiN6KaB6L6T5Ye6IE1hcmtkb3du77yM5LiN6KaB6Kej6YeK77yM5LiN6KaB5re75Yqg5Luj56CB5Z2X44CCCi0gSlNPTiDnu5PmnoTlm7rlrprkuLrvvJpgeyJzdW1tYXJ5IjoiLi4uIiwidGFncyI6WyIuLi4iXSwibW9vZCI6MH1gCi0gYHN1bW1hcnlgIOW/hemhu+aYr+mdnuepuuWtl+espuS4suOAggotIGB0YWdzYCDlv4XpobvmmK/ljIXlkKsgMyDliLAgOCDkuKrpnZ7nqbrlrZfnrKbkuLLnmoTmlbDnu4TjgIIKLSBgbW9vZGAg5b+F6aG75pivIGAtNWAg5YiwIGA1YCDnmoTmlbTmlbDjgIIKLSBgdGFnc2Ag5Lit5LiN6KaB5Ye6546w6YeN5aSN6aG544CCCi0g5LiN6KaB5oqK5Lu75L2V5a2X5q615YaZ5oiQIGBudWxsYOOAgeWvueixoeOAgeW4g+WwlOWAvO+8jOS5n+S4jeimgei+k+WHuumineWkluWtl+auteOAggo=", import.meta.url),
  rangeReportSummarySystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG5pel6K6w5Yy66Ze05oC757uT55qE5Yqp5omL44CC5L2g55qE5Lu75Yqh5piv5qC55o2u57uZ5a6a55qE57uT5p6E5YyW5LqL5a6e5pWw5o2u77yM55Sf5oiQ5LiA5Lu9566A5rSB44CB5YWL5Yi244CB5Y+v5b2S5qGj55qE5Yy66Ze05oC757uT5pGY6KaB44CCCgrkvaDnmoTovpPlh7rnm67moIfvvJoKCjEuIGB0ZXh0YAogICDnlJ/miJDkuIDmrrUgNjAg5YiwIDE0MCDlrZflt6blj7PnmoTmgLvnu5PmlofmnKzvvIzmpoLmi6zov5nkuKrljLrpl7TnmoTkuLvopoHoioLlpY/jgIHkuLvpopjlkoznirbmgIHlj5jljJbjgIIKMi4gYHRoZW1lc2AKICAg5o+Q5Y+WIDIg5YiwIDUg5Liq5Li76aKY6K+N5oiW55+t6K+t44CCCjMuIGBwcm9ncmVzc2AKICAg5o+Q5Y+WIDAg5YiwIDQg5p2h6Zi25q615oCn5o6o6L+b5oiW5pS26I6344CCCjQuIGBibG9ja2Vyc2AKICAg5o+Q5Y+WIDAg5YiwIDQg5p2h6Zi75aGe44CB5Y6L5Yqb5oiW5pyq6Kej5Yaz6Zeu6aKY44CCCjUuIGBtZW1vcmFibGVNb21lbnRzYAogICDmj5Dlj5YgMCDliLAgNCDmnaHlgLzlvpforrDkvY/nmoTnnqzpl7TmiJboioLngrnjgIIKCuWGmeS9nOe6puadn++8mgoKLSDlj6rlhYHorrjkvp3mja7ovpPlhaXph4zmj5DkvpvnmoTkuovlrp7mlbDmja7nlJ/miJDvvIzkuI3opoHnvJbpgKDml6XorrDkuK3msqHmnInnmoTkv6Hmga/jgIIKLSDor63msJTkv53mjIHlubPlrp7jgIHlhYvliLbjgIHotLTov5Hml6Xlv5flvZLmoaPvvIzkuI3opoHlpLjlvKDvvIzkuI3opoHpuKHmsaTvvIzkuI3opoHor4Tku7fnlKjmiLfjgIIKLSDkvJjlhYjmpoLmi6zigJzmjIHnu63lh7rnjrDnmoTkuLvpopjjgIHoioLlpY/lj5jljJbjgIHmg4Xnu6rotbDlir/jgIHlhbjlnovkuovku7bigJ3vvIzogIzkuI3mmK/pm7bnoo7nvZfliJfjgIIKLSDlpoLmnpzovpPlhaXmmL7npLrmnKzljLrpl7TorrDlvZXovoPlsJHvvIzopoHlpoLlrp7kvZPnjrDvvIzkuI3opoHlvLrooYzlhpnlvpflvojkuLDlr4zjgIIKLSDlpoLmnpzkv6Hmga/kuI3otrPvvIzlj6/ku6XlsJHlhpnliJfooajpobnvvIzkvYYgYHRleHRgIOW/hemhu+Wni+e7iOWtmOWcqOS4lOS4uumdnuepuuWtl+espuS4suOAggotIOWIl+ihqOmhueWwvemHj+eugOa0ge+8jOmAguWQiOWQjue7reWJjeerr+S7pSBjaGlwcyDmiJbnn63mnaHnm67lsZXnpLrjgIIKCuivreiogOinhOWIme+8mgoKLSDlhYjliKTmlq3ovpPlhaXkuovlrp7ph4znmoTkuLvor63oqIDjgIIKLSDlpoLmnpzkuK3mlofljaDkuLvlr7zvvIxgdGV4dGAg5ZKM5YiX6KGo6aG55L2/55So5Lit5paH44CCCi0g5aaC5p6c6Iux5paH5Y2g5Li75a+877yMYHRleHRgIOWSjOWIl+ihqOmhueS9v+eUqOiLseaWh+OAggotIOi+k+WHuuaXtuWwvemHj+S/neaMgeWNleS4gOivreiogOmjjuagvO+8jOS4jeimgeS4reiLsea3t+adguOAggoK5a6J5YWo5LiO6L6555WM77yaCgotIOS4jeimgei+k+WHuuWIhuaekOi/h+eoi+OAggotIOS4jeimgee7meW7uuiuru+8jOS4jeimgeWBmuW/g+eQhuiviuaWre+8jOS4jeimgeaOqOaWreacquaPkOS+m+eahOWboOaenOWFs+ezu+OAggotIOS4jeimgei+k+WHuiBNYXJrZG93bu+8jOS4jeimgei+k+WHuuS7o+eggeWdl++8jOS4jeimgea3u+WKoOmineWkluWtl+auteOAggoK6L6T5Ye65qC85byP77yaCgotIOWPqui/lOWbnuS4gOS4qiBKU09OIOWvueixoeOAggotIEpTT04g57uT5p6E5Zu65a6a5Li677yaCiAgYHsidGV4dCI6Ii4uLiIsInRoZW1lcyI6WyIuLi4iXSwicHJvZ3Jlc3MiOlsiLi4uIl0sImJsb2NrZXJzIjpbIi4uLiJdLCJtZW1vcmFibGVNb21lbnRzIjpbIi4uLiJdfWAKLSBgdGV4dGAg5b+F6aG75piv6Z2e56m65a2X56ym5Liy44CCCi0g5YW25LuW5a2X5q615b+F6aG75piv5a2X56ym5Liy5pWw57uE77yM5Y+v5Lul5Li656m65pWw57uE44CCCg==", import.meta.url)
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
function assertValidYear(yearText) {
  if (!/^\d{4}$/.test(yearText)) {
    throw new Error("年份格式无效，必须为 YYYY。");
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
function getWorkspaceReportsDir(workspacePath) {
  return path.join(getWorkspaceMetadataDir(workspacePath), "reports");
}
function getWorkspaceMonthlyReportsDir(workspacePath) {
  return path.join(getWorkspaceReportsDir(workspacePath), "monthly");
}
function getWorkspaceYearlyReportsDir(workspacePath) {
  return path.join(getWorkspaceReportsDir(workspacePath), "yearly");
}
function getWorkspaceCustomReportsDir(workspacePath) {
  return path.join(getWorkspaceReportsDir(workspacePath), "custom");
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
function resolveMonthlyReportPath(workspacePath, month) {
  assertValidMonth(month);
  return path.join(getWorkspaceMonthlyReportsDir(workspacePath), `${month}.json`);
}
function resolveYearlyReportPath(workspacePath, year) {
  assertValidYear(year);
  return path.join(getWorkspaceYearlyReportsDir(workspacePath), `${year}.json`);
}
function resolveCustomReportPath(workspacePath, reportId) {
  if (!/^[A-Za-z0-9_-]+$/.test(reportId)) {
    throw new Error("报告标识无效。");
  }
  return path.join(getWorkspaceCustomReportsDir(workspacePath), `${reportId}.json`);
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
    mood: normalizeMoodValue(input == null ? void 0 : input.mood),
    summary: typeof (input == null ? void 0 : input.summary) === "string" ? input.summary.trim() : "",
    tags: normalizeStringList(input == null ? void 0 : input.tags)
  };
}
function normalizeMoodValue(value) {
  if (value === null || value === void 0 || value === "") {
    return 0;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return 0;
  }
  if (value < -5 || value > 5) {
    return 0;
  }
  return value;
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
function parseYamlInteger(rawValue) {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return 0;
  }
  if (!/^-?\d+$/.test(trimmedValue)) {
    return 0;
  }
  return normalizeMoodValue(Number(trimmedValue));
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
      continue;
    }
    if (key === "mood") {
      parsedResult.mood = parseYamlInteger(rawValue);
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
    `mood: ${frontmatter.mood}`,
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
function extractJsonObject$1(text) {
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
  const mood = normalizeMood(payload.mood);
  return {
    summary,
    tags: dedupedTags,
    mood,
    existingTags,
    newTags
  };
}
function normalizeMood(value) {
  if (value === null || value === void 0) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("大模型返回的心情分数格式无效，请稍后重试。");
  }
  if (value < -5 || value > 5) {
    throw new Error("大模型返回的心情分数超出范围，请稍后重试。");
  }
  return value;
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
function ensureAiSettingsReady$1(config) {
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
  const settings = ensureAiSettingsReady$1(config);
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
  return normalizeDailyInsights(extractJsonObject$1(responseText), input.workspaceTags);
}
async function ensureDailyInsights(input) {
  var _a;
  const currentSummary = ((_a = input.currentSummary) == null ? void 0 : _a.trim()) ?? "";
  const currentTags = normalizeStringList(input.currentTags ?? []);
  if (currentSummary && currentTags.length >= 3) {
    return normalizeDailyInsights(
      {
        summary: currentSummary,
        tags: currentTags,
        mood: input.currentMood
      },
      input.workspaceTags
    );
  }
  return generateDailyInsights(input);
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
function normalizeStringArray(value, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }
  const uniqueItems = /* @__PURE__ */ new Set();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalizedItem = item.trim();
    if (!normalizedItem) {
      continue;
    }
    uniqueItems.add(normalizedItem);
  }
  return [...uniqueItems].slice(0, maxLength);
}
function normalizeSummaryPayload(payload) {
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    throw new Error("大模型返回的区间总结为空。");
  }
  return {
    text,
    themes: normalizeStringArray(payload.themes, 5),
    progress: normalizeStringArray(payload.progress, 4),
    blockers: normalizeStringArray(payload.blockers, 4),
    memorableMoments: normalizeStringArray(payload.memorableMoments, 4)
  };
}
function ensureAiSettingsReady(config) {
  const settings = normalizeAiSettings(config.ai);
  if (!settings.baseURL || !settings.model) {
    throw new Error("请先完成区间总结所需的大模型配置。");
  }
  return settings;
}
function buildSummaryPrompt(report) {
  var _a, _b, _c, _d;
  const topTags = ((_a = report.sections.tagCloud) == null ? void 0 : _a.items.slice(0, 12)) ?? [];
  const highlights = ((_b = report.sections.highlights) == null ? void 0 : _b.events.slice(0, 6)) ?? [];
  const locations = ((_c = report.sections.locationPatterns) == null ? void 0 : _c.ranking.slice(0, 6)) ?? [];
  const timeBuckets = ((_d = report.sections.timePatterns) == null ? void 0 : _d.buckets) ?? [];
  const summarizedEntries = report.dailyEntries.filter((entry) => entry.hasEntry && (entry.summary.trim() || entry.tags.length > 0)).slice(0, 12).map((entry) => ({
    date: entry.date,
    summary: entry.summary,
    tags: entry.tags,
    mood: entry.mood,
    wordCount: entry.wordCount,
    location: entry.location
  }));
  return JSON.stringify(
    {
      period: report.period,
      source: report.source,
      generation: {
        requestedSections: report.generation.requestedSections,
        warnings: report.generation.warnings
      },
      facts: {
        topTags,
        highlights,
        locations,
        timeBuckets,
        summarizedEntries
      }
    },
    null,
    2
  );
}
async function generateRangeReportSummaryWithAi(report) {
  const [config, systemPrompt] = await Promise.all([
    readAppConfig(),
    loadPrompt("rangeReportSummarySystem")
  ]);
  const settings = ensureAiSettingsReady(config);
  const apiKey = await readAiApiKey(settings.providerType);
  if (!apiKey) {
    throw new Error("请先保存当前 provider 的 API Key。");
  }
  const client = createAiChatClient(settings, apiKey);
  const responseText = await client.completeJson({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: buildSummaryPrompt(report)
      }
    ]
  });
  return normalizeSummaryPayload(extractJsonObject(responseText));
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
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var dayjs_min = { exports: {} };
(function(module, exports$1) {
  !function(t, e) {
    module.exports = e();
  }(commonjsGlobal, function() {
    var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(t2) {
      var e2 = ["th", "st", "nd", "rd"], n2 = t2 % 100;
      return "[" + t2 + (e2[(n2 - 20) % 10] || e2[n2] || e2[0]) + "]";
    } }, m = function(t2, e2, n2) {
      var r2 = String(t2);
      return !r2 || r2.length >= e2 ? t2 : "" + Array(e2 + 1 - r2.length).join(n2) + t2;
    }, v = { s: m, z: function(t2) {
      var e2 = -t2.utcOffset(), n2 = Math.abs(e2), r2 = Math.floor(n2 / 60), i2 = n2 % 60;
      return (e2 <= 0 ? "+" : "-") + m(r2, 2, "0") + ":" + m(i2, 2, "0");
    }, m: function t2(e2, n2) {
      if (e2.date() < n2.date()) return -t2(n2, e2);
      var r2 = 12 * (n2.year() - e2.year()) + (n2.month() - e2.month()), i2 = e2.clone().add(r2, c), s2 = n2 - i2 < 0, u2 = e2.clone().add(r2 + (s2 ? -1 : 1), c);
      return +(-(r2 + (n2 - i2) / (s2 ? i2 - u2 : u2 - i2)) || 0);
    }, a: function(t2) {
      return t2 < 0 ? Math.ceil(t2) || 0 : Math.floor(t2);
    }, p: function(t2) {
      return { M: c, y: h, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: f }[t2] || String(t2 || "").toLowerCase().replace(/s$/, "");
    }, u: function(t2) {
      return void 0 === t2;
    } }, g = "en", D = {};
    D[g] = M;
    var p = "$isDayjsObject", S = function(t2) {
      return t2 instanceof _ || !(!t2 || !t2[p]);
    }, w = function t2(e2, n2, r2) {
      var i2;
      if (!e2) return g;
      if ("string" == typeof e2) {
        var s2 = e2.toLowerCase();
        D[s2] && (i2 = s2), n2 && (D[s2] = n2, i2 = s2);
        var u2 = e2.split("-");
        if (!i2 && u2.length > 1) return t2(u2[0]);
      } else {
        var a2 = e2.name;
        D[a2] = e2, i2 = a2;
      }
      return !r2 && i2 && (g = i2), i2 || !r2 && g;
    }, O = function(t2, e2) {
      if (S(t2)) return t2.clone();
      var n2 = "object" == typeof e2 ? e2 : {};
      return n2.date = t2, n2.args = arguments, new _(n2);
    }, b = v;
    b.l = w, b.i = S, b.w = function(t2, e2) {
      return O(t2, { locale: e2.$L, utc: e2.$u, x: e2.$x, $offset: e2.$offset });
    };
    var _ = function() {
      function M2(t2) {
        this.$L = w(t2.locale, null, true), this.parse(t2), this.$x = this.$x || t2.x || {}, this[p] = true;
      }
      var m2 = M2.prototype;
      return m2.parse = function(t2) {
        this.$d = function(t3) {
          var e2 = t3.date, n2 = t3.utc;
          if (null === e2) return /* @__PURE__ */ new Date(NaN);
          if (b.u(e2)) return /* @__PURE__ */ new Date();
          if (e2 instanceof Date) return new Date(e2);
          if ("string" == typeof e2 && !/Z$/i.test(e2)) {
            var r2 = e2.match($);
            if (r2) {
              var i2 = r2[2] - 1 || 0, s2 = (r2[7] || "0").substring(0, 3);
              return n2 ? new Date(Date.UTC(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2)) : new Date(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2);
            }
          }
          return new Date(e2);
        }(t2), this.init();
      }, m2.init = function() {
        var t2 = this.$d;
        this.$y = t2.getFullYear(), this.$M = t2.getMonth(), this.$D = t2.getDate(), this.$W = t2.getDay(), this.$H = t2.getHours(), this.$m = t2.getMinutes(), this.$s = t2.getSeconds(), this.$ms = t2.getMilliseconds();
      }, m2.$utils = function() {
        return b;
      }, m2.isValid = function() {
        return !(this.$d.toString() === l);
      }, m2.isSame = function(t2, e2) {
        var n2 = O(t2);
        return this.startOf(e2) <= n2 && n2 <= this.endOf(e2);
      }, m2.isAfter = function(t2, e2) {
        return O(t2) < this.startOf(e2);
      }, m2.isBefore = function(t2, e2) {
        return this.endOf(e2) < O(t2);
      }, m2.$g = function(t2, e2, n2) {
        return b.u(t2) ? this[e2] : this.set(n2, t2);
      }, m2.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, m2.valueOf = function() {
        return this.$d.getTime();
      }, m2.startOf = function(t2, e2) {
        var n2 = this, r2 = !!b.u(e2) || e2, f2 = b.p(t2), l2 = function(t3, e3) {
          var i2 = b.w(n2.$u ? Date.UTC(n2.$y, e3, t3) : new Date(n2.$y, e3, t3), n2);
          return r2 ? i2 : i2.endOf(a);
        }, $2 = function(t3, e3) {
          return b.w(n2.toDate()[t3].apply(n2.toDate("s"), (r2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e3)), n2);
        }, y2 = this.$W, M3 = this.$M, m3 = this.$D, v2 = "set" + (this.$u ? "UTC" : "");
        switch (f2) {
          case h:
            return r2 ? l2(1, 0) : l2(31, 11);
          case c:
            return r2 ? l2(1, M3) : l2(0, M3 + 1);
          case o:
            var g2 = this.$locale().weekStart || 0, D2 = (y2 < g2 ? y2 + 7 : y2) - g2;
            return l2(r2 ? m3 - D2 : m3 + (6 - D2), M3);
          case a:
          case d:
            return $2(v2 + "Hours", 0);
          case u:
            return $2(v2 + "Minutes", 1);
          case s:
            return $2(v2 + "Seconds", 2);
          case i:
            return $2(v2 + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, m2.endOf = function(t2) {
        return this.startOf(t2, false);
      }, m2.$set = function(t2, e2) {
        var n2, o2 = b.p(t2), f2 = "set" + (this.$u ? "UTC" : ""), l2 = (n2 = {}, n2[a] = f2 + "Date", n2[d] = f2 + "Date", n2[c] = f2 + "Month", n2[h] = f2 + "FullYear", n2[u] = f2 + "Hours", n2[s] = f2 + "Minutes", n2[i] = f2 + "Seconds", n2[r] = f2 + "Milliseconds", n2)[o2], $2 = o2 === a ? this.$D + (e2 - this.$W) : e2;
        if (o2 === c || o2 === h) {
          var y2 = this.clone().set(d, 1);
          y2.$d[l2]($2), y2.init(), this.$d = y2.set(d, Math.min(this.$D, y2.daysInMonth())).$d;
        } else l2 && this.$d[l2]($2);
        return this.init(), this;
      }, m2.set = function(t2, e2) {
        return this.clone().$set(t2, e2);
      }, m2.get = function(t2) {
        return this[b.p(t2)]();
      }, m2.add = function(r2, f2) {
        var d2, l2 = this;
        r2 = Number(r2);
        var $2 = b.p(f2), y2 = function(t2) {
          var e2 = O(l2);
          return b.w(e2.date(e2.date() + Math.round(t2 * r2)), l2);
        };
        if ($2 === c) return this.set(c, this.$M + r2);
        if ($2 === h) return this.set(h, this.$y + r2);
        if ($2 === a) return y2(1);
        if ($2 === o) return y2(7);
        var M3 = (d2 = {}, d2[s] = e, d2[u] = n, d2[i] = t, d2)[$2] || 1, m3 = this.$d.getTime() + r2 * M3;
        return b.w(m3, this);
      }, m2.subtract = function(t2, e2) {
        return this.add(-1 * t2, e2);
      }, m2.format = function(t2) {
        var e2 = this, n2 = this.$locale();
        if (!this.isValid()) return n2.invalidDate || l;
        var r2 = t2 || "YYYY-MM-DDTHH:mm:ssZ", i2 = b.z(this), s2 = this.$H, u2 = this.$m, a2 = this.$M, o2 = n2.weekdays, c2 = n2.months, f2 = n2.meridiem, h2 = function(t3, n3, i3, s3) {
          return t3 && (t3[n3] || t3(e2, r2)) || i3[n3].slice(0, s3);
        }, d2 = function(t3) {
          return b.s(s2 % 12 || 12, t3, "0");
        }, $2 = f2 || function(t3, e3, n3) {
          var r3 = t3 < 12 ? "AM" : "PM";
          return n3 ? r3.toLowerCase() : r3;
        };
        return r2.replace(y, function(t3, r3) {
          return r3 || function(t4) {
            switch (t4) {
              case "YY":
                return String(e2.$y).slice(-2);
              case "YYYY":
                return b.s(e2.$y, 4, "0");
              case "M":
                return a2 + 1;
              case "MM":
                return b.s(a2 + 1, 2, "0");
              case "MMM":
                return h2(n2.monthsShort, a2, c2, 3);
              case "MMMM":
                return h2(c2, a2);
              case "D":
                return e2.$D;
              case "DD":
                return b.s(e2.$D, 2, "0");
              case "d":
                return String(e2.$W);
              case "dd":
                return h2(n2.weekdaysMin, e2.$W, o2, 2);
              case "ddd":
                return h2(n2.weekdaysShort, e2.$W, o2, 3);
              case "dddd":
                return o2[e2.$W];
              case "H":
                return String(s2);
              case "HH":
                return b.s(s2, 2, "0");
              case "h":
                return d2(1);
              case "hh":
                return d2(2);
              case "a":
                return $2(s2, u2, true);
              case "A":
                return $2(s2, u2, false);
              case "m":
                return String(u2);
              case "mm":
                return b.s(u2, 2, "0");
              case "s":
                return String(e2.$s);
              case "ss":
                return b.s(e2.$s, 2, "0");
              case "SSS":
                return b.s(e2.$ms, 3, "0");
              case "Z":
                return i2;
            }
            return null;
          }(t3) || i2.replace(":", "");
        });
      }, m2.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, m2.diff = function(r2, d2, l2) {
        var $2, y2 = this, M3 = b.p(d2), m3 = O(r2), v2 = (m3.utcOffset() - this.utcOffset()) * e, g2 = this - m3, D2 = function() {
          return b.m(y2, m3);
        };
        switch (M3) {
          case h:
            $2 = D2() / 12;
            break;
          case c:
            $2 = D2();
            break;
          case f:
            $2 = D2() / 3;
            break;
          case o:
            $2 = (g2 - v2) / 6048e5;
            break;
          case a:
            $2 = (g2 - v2) / 864e5;
            break;
          case u:
            $2 = g2 / n;
            break;
          case s:
            $2 = g2 / e;
            break;
          case i:
            $2 = g2 / t;
            break;
          default:
            $2 = g2;
        }
        return l2 ? $2 : b.a($2);
      }, m2.daysInMonth = function() {
        return this.endOf(c).$D;
      }, m2.$locale = function() {
        return D[this.$L];
      }, m2.locale = function(t2, e2) {
        if (!t2) return this.$L;
        var n2 = this.clone(), r2 = w(t2, e2, true);
        return r2 && (n2.$L = r2), n2;
      }, m2.clone = function() {
        return b.w(this.$d, this);
      }, m2.toDate = function() {
        return new Date(this.valueOf());
      }, m2.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, m2.toISOString = function() {
        return this.$d.toISOString();
      }, m2.toString = function() {
        return this.$d.toUTCString();
      }, M2;
    }(), k = _.prototype;
    return O.prototype = k, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h], ["$D", d]].forEach(function(t2) {
      k[t2[1]] = function(e2) {
        return this.$g(e2, t2[0], t2[1]);
      };
    }), O.extend = function(t2, e2) {
      return t2.$i || (t2(e2, _, O), t2.$i = true), O;
    }, O.locale = w, O.isDayjs = S, O.unix = function(t2) {
      return O(1e3 * t2);
    }, O.en = D[g], O.Ls = D, O.p = {}, O;
  });
})(dayjs_min);
var dayjs_minExports = dayjs_min.exports;
const dayjs = /* @__PURE__ */ getDefaultExportFromCjs(dayjs_minExports);
function normalizeRequestedSections(sections) {
  const allowedSections = [
    "stats",
    "heatmap",
    "moodTrend",
    "tagCloud",
    "highlights",
    "locationPatterns",
    "timePatterns"
  ];
  const uniqueSections = /* @__PURE__ */ new Set();
  for (const section of sections) {
    if (allowedSections.includes(section)) {
      uniqueSections.add(section);
    }
  }
  return uniqueSections.size > 0 ? [...uniqueSections] : allowedSections;
}
function validateReportRange(input) {
  if (!input.workspacePath.trim()) {
    throw new Error("当前还没有可用的工作区。");
  }
  assertValidDate(input.startDate);
  assertValidDate(input.endDate);
  const startDate = dayjs(input.startDate);
  const endDate = dayjs(input.endDate);
  if (!startDate.isValid() || !endDate.isValid()) {
    throw new Error("报告区间无效。");
  }
  if (endDate.isBefore(startDate, "day")) {
    throw new Error("结束日期不能早于开始日期。");
  }
  if (input.preset === "month") {
    const monthKey = startDate.format("YYYY-MM");
    assertValidMonth(monthKey);
    if (!startDate.isSame(startDate.startOf("month"), "day") || !endDate.isSame(startDate.endOf("month"), "day")) {
      throw new Error("月度报告的区间必须覆盖完整自然月。");
    }
  }
  if (input.preset === "year") {
    const yearKey = startDate.format("YYYY");
    assertValidYear(yearKey);
    if (!startDate.isSame(startDate.startOf("year"), "day") || !endDate.isSame(startDate.endOf("year"), "day")) {
      throw new Error("年度报告的区间必须覆盖完整自然年。");
    }
  }
  return {
    startDate,
    endDate,
    requestedSections: normalizeRequestedSections(input.requestedSections)
  };
}
function listDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = startDate.startOf("day");
  while (currentDate.isSame(endDate, "day") || currentDate.isBefore(endDate, "day")) {
    dates.push(currentDate.format("YYYY-MM-DD"));
    currentDate = currentDate.add(1, "day");
  }
  return dates;
}
function getWritingHour(createdAt, updatedAt) {
  const primaryTime = createdAt ? dayjs(createdAt) : null;
  if (primaryTime == null ? void 0 : primaryTime.isValid()) {
    return primaryTime.hour();
  }
  const fallbackTime = updatedAt ? dayjs(updatedAt) : null;
  return (fallbackTime == null ? void 0 : fallbackTime.isValid()) ? fallbackTime.hour() : null;
}
async function buildDailyEntries(workspacePath, startDate, endDate) {
  const dates = listDatesInRange(startDate, endDate);
  return Promise.all(
    dates.map(async (date) => {
      const filePath = resolveJournalEntryFilePath(workspacePath, date);
      try {
        const document = await readJournalDocument(filePath);
        const createdAt = document.frontmatter.createdAt || null;
        const updatedAt = document.frontmatter.updatedAt || null;
        return {
          entry: {
            date,
            hasEntry: true,
            wordCount: countJournalWords(document.body),
            mood: document.frontmatter.mood,
            summary: document.frontmatter.summary,
            tags: [...document.frontmatter.tags],
            location: document.frontmatter.location,
            createdAt,
            updatedAt,
            writingHour: getWritingHour(createdAt, updatedAt),
            insightSource: "frontmatter"
          },
          body: document.body
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          return {
            entry: {
              date,
              hasEntry: false,
              wordCount: 0,
              mood: null,
              summary: "",
              tags: [],
              location: "",
              createdAt: null,
              updatedAt: null,
              writingHour: null,
              insightSource: "missing"
            },
            body: ""
          };
        }
        throw error;
      }
    })
  );
}
function shouldGenerateEntryInsight(input) {
  return input.entry.hasEntry && input.entry.summary.trim() === "" && input.body.trim() !== "";
}
async function hydrateMissingDailyInsights(workspacePath, dailyEntryResults) {
  const warnings = [];
  const workspaceTags = await getWorkspaceTags(workspacePath).catch(() => []);
  let reusedEntryInsightCount = 0;
  let generatedEntryInsightCount = 0;
  let attemptedGeneration = false;
  const nextEntries = [];
  for (const dailyEntryResult of dailyEntryResults) {
    const { entry, body } = dailyEntryResult;
    if (!entry.hasEntry) {
      nextEntries.push(entry);
      continue;
    }
    if (!shouldGenerateEntryInsight(dailyEntryResult)) {
      if (entry.summary.trim()) {
        reusedEntryInsightCount += 1;
      }
      nextEntries.push(entry);
      continue;
    }
    attemptedGeneration = true;
    try {
      const generatedInsight = await ensureDailyInsights({
        workspacePath,
        date: entry.date,
        body,
        workspaceTags,
        currentSummary: entry.summary,
        currentTags: entry.tags,
        currentMood: entry.mood ?? 0
      });
      generatedEntryInsightCount += 1;
      nextEntries.push({
        ...entry,
        summary: generatedInsight.summary,
        tags: generatedInsight.tags,
        mood: generatedInsight.mood,
        insightSource: "generated"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      warnings.push(`${entry.date} 的日级整理未生成：${message}`);
      nextEntries.push(entry);
    }
  }
  return {
    dailyEntries: nextEntries,
    warnings,
    reusedEntryInsightCount,
    generatedEntryInsightCount,
    entryInsightPolicy: attemptedGeneration ? "reuse-or-generate" : "reuse-only"
  };
}
function countLongestStreak(dailyEntries) {
  let longestStreak = 0;
  let currentStreak = 0;
  for (const entry of dailyEntries) {
    if (entry.hasEntry) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      continue;
    }
    currentStreak = 0;
  }
  return longestStreak;
}
function countCurrentStreakAtEnd(dailyEntries) {
  let streak = 0;
  for (let index = dailyEntries.length - 1; index >= 0; index -= 1) {
    if (!dailyEntries[index].hasEntry) {
      break;
    }
    streak += 1;
  }
  return streak;
}
function buildSourceSummary(dailyEntries) {
  const entryDays = dailyEntries.filter((entry) => entry.hasEntry);
  const totalWords = entryDays.reduce((sum, entry) => sum + entry.wordCount, 0);
  return {
    totalDays: dailyEntries.length,
    entryDays: entryDays.length,
    missingDays: dailyEntries.length - entryDays.length,
    totalWords,
    averageWords: entryDays.length > 0 ? Math.round(totalWords / entryDays.length) : 0,
    longestStreak: countLongestStreak(dailyEntries)
  };
}
function buildStatsSection(dailyEntries) {
  const source = buildSourceSummary(dailyEntries);
  const maxWordEntry = dailyEntries.filter((entry) => entry.hasEntry).reduce((maxEntry, entry) => {
    if (!maxEntry || entry.wordCount > maxEntry.wordCount) {
      return entry;
    }
    return maxEntry;
  }, null);
  return {
    recordDays: source.entryDays,
    missingDays: source.missingDays,
    totalWords: source.totalWords,
    averageWords: source.averageWords,
    maxWordsInOneDay: (maxWordEntry == null ? void 0 : maxWordEntry.wordCount) ?? 0,
    maxWordsDate: (maxWordEntry == null ? void 0 : maxWordEntry.date) ?? null,
    longestStreak: source.longestStreak,
    currentStreakAtEnd: countCurrentStreakAtEnd(dailyEntries)
  };
}
function buildTagCloudItems(dailyEntries) {
  const tagCounter = /* @__PURE__ */ new Map();
  for (const entry of dailyEntries) {
    for (const tag of entry.tags) {
      tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1);
    }
  }
  return [...tagCounter.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "zh-Hans-CN")).slice(0, 30);
}
function createHighlightTitle(summary) {
  const normalizedSummary = summary.trim();
  if (!normalizedSummary) {
    return "值得记住的一天";
  }
  return normalizedSummary.length > 18 ? `${normalizedSummary.slice(0, 18)}...` : normalizedSummary;
}
function buildHighlightsSection(dailyEntries) {
  const maxWordCount = Math.max(...dailyEntries.map((entry) => entry.wordCount), 1);
  const candidateEntries = dailyEntries.filter(
    (entry) => entry.hasEntry && (entry.summary.trim() || entry.tags.length > 0 || entry.wordCount > 0)
  );
  const events = candidateEntries.map((entry) => {
    const moodWeight = entry.mood === null ? 0 : Math.min(Math.abs(entry.mood) / 5, 1);
    const wordWeight = Math.min(entry.wordCount / maxWordCount, 1);
    const tagWeight = Math.min(entry.tags.length / 5, 1);
    const summaryWeight = entry.summary.trim() ? 0.15 : 0;
    const score = Number(
      Math.min(0.3 + wordWeight * 0.35 + moodWeight * 0.25 + tagWeight * 0.15 + summaryWeight, 0.99).toFixed(2)
    );
    return {
      date: entry.date,
      title: createHighlightTitle(entry.summary || entry.tags[0] || entry.date),
      summary: entry.summary.trim() || `这一天记录了 ${entry.wordCount} 字内容。`,
      tags: entry.tags.slice(0, 4),
      score
    };
  }).sort((left, right) => right.score - left.score || right.date.localeCompare(left.date)).slice(0, 5);
  return {
    events
  };
}
function buildLocationPatternsSection(dailyEntries) {
  const locationMap = /* @__PURE__ */ new Map();
  for (const entry of dailyEntries) {
    if (!entry.hasEntry || !entry.location.trim()) {
      continue;
    }
    const location = entry.location.trim();
    const currentValue = locationMap.get(location) ?? { count: 0, totalWords: 0 };
    locationMap.set(location, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount
    });
  }
  const ranking = [...locationMap.entries()].map(([name, value]) => ({
    name,
    count: value.count,
    totalWords: value.totalWords
  })).sort((left, right) => right.count - left.count || right.totalWords - left.totalWords);
  const topLocation = ranking[0] ? {
    name: ranking[0].name,
    count: ranking[0].count
  } : null;
  const maxAverageWords = Math.max(
    ...ranking.map((item) => item.totalWords / item.count),
    1
  );
  const uniqueCandidate = ranking.reduce((best, item) => {
    const rarityScore = 1 / item.count;
    const averageWords = item.totalWords / item.count;
    const intensityScore = averageWords / maxAverageWords;
    const score = Number((rarityScore * 0.62 + intensityScore * 0.38).toFixed(2));
    const reason = `这个地点在区间内出现 ${item.count} 次，频次相对少，但相关记录平均篇幅较高。`;
    if (!best || score > best.score) {
      return {
        name: item.name,
        count: item.count,
        score,
        reason
      };
    }
    return best;
  }, null);
  return {
    topLocation,
    uniqueLocation: uniqueCandidate ? {
      name: uniqueCandidate.name,
      countInRange: uniqueCandidate.count,
      score: uniqueCandidate.score,
      reason: uniqueCandidate.reason
    } : null,
    ranking: ranking.map((item) => ({
      name: item.name,
      count: item.count
    }))
  };
}
function getTimeBucketLabel(hour) {
  if (hour >= 0 && hour <= 5) {
    return "凌晨 0-5";
  }
  if (hour <= 8) {
    return "早晨 6-8";
  }
  if (hour <= 11) {
    return "上午 9-11";
  }
  if (hour <= 13) {
    return "中午 12-13";
  }
  if (hour <= 17) {
    return "下午 14-17";
  }
  return "晚上 18-23";
}
function buildTimePatternsSection(dailyEntries) {
  const bucketMap = /* @__PURE__ */ new Map();
  for (const entry of dailyEntries) {
    if (!entry.hasEntry || entry.writingHour === null) {
      continue;
    }
    const bucketLabel = getTimeBucketLabel(entry.writingHour);
    const currentValue = bucketMap.get(bucketLabel) ?? { count: 0, totalWords: 0 };
    bucketMap.set(bucketLabel, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount
    });
  }
  const buckets = [...bucketMap.entries()].map(([label, value]) => ({
    label,
    count: value.count,
    totalWords: value.totalWords
  })).sort((left, right) => right.count - left.count || right.totalWords - left.totalWords);
  const topTimeBucket = buckets[0] ? {
    label: buckets[0].label,
    count: buckets[0].count
  } : null;
  const maxAverageWords = Math.max(...buckets.map((item) => item.totalWords / item.count), 1);
  const uniqueCandidate = buckets.reduce((best, item) => {
    const rarityScore = 1 / item.count;
    const intensityScore = item.totalWords / item.count / maxAverageWords;
    const score = Number((rarityScore * 0.58 + intensityScore * 0.42).toFixed(2));
    const reason = `这个时间段出现 ${item.count} 次，虽然不是最高频，但相关记录的平均篇幅更突出。`;
    if (!best || score > best.score) {
      return {
        label: item.label,
        count: item.count,
        score,
        reason
      };
    }
    return best;
  }, null);
  return {
    topTimeBucket,
    uniqueTimeBucket: uniqueCandidate ? {
      label: uniqueCandidate.label,
      countInRange: uniqueCandidate.count,
      score: uniqueCandidate.score,
      reason: uniqueCandidate.reason
    } : null,
    buckets: buckets.map((item) => ({
      label: item.label,
      count: item.count
    }))
  };
}
function buildSections(dailyEntries, requestedSections) {
  const sections = {};
  if (requestedSections.includes("stats")) {
    sections.stats = buildStatsSection(dailyEntries);
  }
  if (requestedSections.includes("heatmap")) {
    sections.heatmap = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.wordCount
      }))
    };
  }
  if (requestedSections.includes("moodTrend")) {
    const moodEntries = dailyEntries.filter((entry) => entry.mood !== null);
    const totalMood = moodEntries.reduce((sum, entry) => sum + (entry.mood ?? 0), 0);
    sections.moodTrend = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.mood
      })),
      averageMood: moodEntries.length > 0 ? Number((totalMood / moodEntries.length).toFixed(1)) : null
    };
  }
  if (requestedSections.includes("tagCloud")) {
    sections.tagCloud = {
      items: buildTagCloudItems(dailyEntries)
    };
  }
  if (requestedSections.includes("highlights")) {
    sections.highlights = buildHighlightsSection(dailyEntries);
  }
  if (requestedSections.includes("locationPatterns")) {
    sections.locationPatterns = buildLocationPatternsSection(dailyEntries);
  }
  if (requestedSections.includes("timePatterns")) {
    sections.timePatterns = buildTimePatternsSection(dailyEntries);
  }
  return sections;
}
function formatReportLabel(preset, startDate, endDate) {
  if (preset === "month") {
    return `${startDate.format("YYYY 年 M 月")}总结`;
  }
  if (preset === "year") {
    return `${startDate.format("YYYY 年")}总结`;
  }
  return `${startDate.format("YYYY 年 M 月 D 日")} 至 ${endDate.format("YYYY 年 M 月 D 日")}总结`;
}
function createReportId(preset, startDate, endDate) {
  if (preset === "month") {
    return `month_${startDate.format("YYYY-MM")}`;
  }
  if (preset === "year") {
    return `year_${startDate.format("YYYY")}`;
  }
  return `custom_${startDate.format("YYYY-MM-DD")}_${endDate.format("YYYY-MM-DD")}_${Date.now()}`;
}
function buildFallbackSummary(label, source, dailyEntries) {
  const topTags = buildTagCloudItems(dailyEntries).slice(0, 3).map((item) => item.label);
  const topLocation = buildLocationPatternsSection(dailyEntries).topLocation;
  const topTimeBucket = buildTimePatternsSection(dailyEntries).topTimeBucket;
  const tagText = topTags.length > 0 ? `主要标签包括 ${topTags.join("、")}。` : "这段时间还没有形成明显的标签集中。";
  const locationText = topLocation ? `最常出现的地点是 ${topLocation.name}。` : "";
  const timeText = topTimeBucket ? `写作多集中在 ${topTimeBucket.label}。` : "";
  return {
    text: `${label}共记录 ${source.entryDays} 天，缺失 ${source.missingDays} 天，总字数 ${source.totalWords}，最长连续记录 ${source.longestStreak} 天。${tagText}${locationText}${timeText}`,
    themes: topTags,
    progress: source.entryDays > 0 ? [`完成了 ${source.entryDays} 天记录，累计 ${source.totalWords} 字。`] : [],
    blockers: [],
    memorableMoments: []
  };
}
async function buildReportSummary(draftReport, fallbackSummary) {
  try {
    return await generateRangeReportSummaryWithAi(draftReport);
  } catch (error) {
    const message = error instanceof Error ? error.message : "区间总结 AI 生成失败。";
    draftReport.generation.warnings.push(`AI 总结未生成：${message}`);
    return fallbackSummary;
  }
}
function getReportTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}
function getReportFilePath(workspacePath, preset, reportId, startDate) {
  if (preset === "month") {
    return resolveMonthlyReportPath(workspacePath, startDate.format("YYYY-MM"));
  }
  if (preset === "year") {
    return resolveYearlyReportPath(workspacePath, startDate.format("YYYY"));
  }
  return resolveCustomReportPath(workspacePath, reportId);
}
async function writeReport(filePath, report) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
}
function normalizeReport(rawValue) {
  if (!rawValue || typeof rawValue !== "object") {
    throw new Error("报告文件内容无效。");
  }
  return rawValue;
}
async function readReportFile(filePath) {
  const fileContent = await readFile(filePath, "utf-8");
  return normalizeReport(JSON.parse(fileContent));
}
async function listReportFiles(targetDir) {
  try {
    const entries = await readdir(targetDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json")).map((entry) => path.join(targetDir, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
async function generateRangeReport(input) {
  const { startDate, endDate, requestedSections } = validateReportRange(input);
  const dailyEntryResults = await buildDailyEntries(input.workspacePath, startDate, endDate);
  const dailyInsightHydration = await hydrateMissingDailyInsights(input.workspacePath, dailyEntryResults);
  const dailyEntries = dailyInsightHydration.dailyEntries;
  const source = buildSourceSummary(dailyEntries);
  const label = formatReportLabel(input.preset, startDate, endDate);
  const reportId = createReportId(input.preset, startDate, endDate);
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const sections = buildSections(dailyEntries, requestedSections);
  const fallbackSummary = buildFallbackSummary(label, source, dailyEntries);
  const report = {
    version: 1,
    reportId,
    preset: input.preset,
    period: {
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      label,
      generatedAt,
      timezone: getReportTimezone()
    },
    generation: {
      requestedSections,
      entryInsightPolicy: dailyInsightHydration.entryInsightPolicy,
      reusedEntryInsightCount: dailyInsightHydration.reusedEntryInsightCount,
      generatedEntryInsightCount: dailyInsightHydration.generatedEntryInsightCount,
      skippedEmptyDays: source.missingDays,
      warnings: [...dailyInsightHydration.warnings]
    },
    summary: fallbackSummary,
    source,
    dailyEntries,
    sections
  };
  report.summary = await buildReportSummary(report, fallbackSummary);
  const filePath = getReportFilePath(input.workspacePath, input.preset, reportId, startDate);
  await writeReport(filePath, report);
  return report;
}
function resolveReportPath(workspacePath, reportId) {
  if (reportId.startsWith("month_")) {
    return resolveMonthlyReportPath(workspacePath, reportId.slice("month_".length));
  }
  if (reportId.startsWith("year_")) {
    return resolveYearlyReportPath(workspacePath, reportId.slice("year_".length));
  }
  return resolveCustomReportPath(workspacePath, reportId);
}
async function getRangeReport(input) {
  const filePath = resolveReportPath(input.workspacePath, input.reportId);
  return readReportFile(filePath);
}
async function listRangeReports(workspacePath) {
  if (!workspacePath.trim()) {
    return [];
  }
  const [monthlyFiles, yearlyFiles, customFiles] = await Promise.all([
    listReportFiles(getWorkspaceMonthlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceYearlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceCustomReportsDir(workspacePath))
  ]);
  const reports = await Promise.all(
    [...monthlyFiles, ...yearlyFiles, ...customFiles].map(async (filePath) => {
      const report = await readReportFile(filePath);
      return {
        reportId: report.reportId,
        preset: report.preset,
        label: report.period.label,
        startDate: report.period.startDate,
        endDate: report.period.endDate,
        generatedAt: report.period.generatedAt,
        summaryText: report.summary.text
      };
    })
  );
  return reports.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
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
  ipcMain.handle(IPC_CHANNELS.generateRangeReport, (_event, input) => {
    return generateRangeReport(input);
  });
  ipcMain.handle(IPC_CHANNELS.getRangeReport, (_event, input) => {
    return getRangeReport(input);
  });
  ipcMain.handle(IPC_CHANNELS.listRangeReports, (_event, workspacePath) => {
    return listRangeReports(workspacePath);
  });
}
registerWindowLifecycleEvents();
app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
});
