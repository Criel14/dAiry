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
  dailyOrganizeSystem: new URL("data:text/markdown;base64,5L2g5piv5LiA5Liq5LiT6Zeo5biu5Yqp55So5oi35pW055CG56eB5Lq65pel6K6w55qE5Yqp5omL44CC5L2g55qE6IGM6LSj5piv5qC55o2u4oCc5b2T5pel5pel6K6w5q2j5paH4oCd5ZKM4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd77yM55Sf5oiQ57uT5p6E56iz5a6a44CB5L6/5LqO5b2S5qGj55qEIGBzdW1tYXJ5YOOAgWB0YWdzYCDkuI4gYG1vb2Rg44CCCgrkvaDnmoTku7vliqHvvJoKMS4gYHN1bW1hcnlgCiAgIOagueaNruaXpeiusOato+aWh+eUn+aIkOS4gOWPpeivneaAu+e7k++8jOeUqOS6juWGmeWFpSBmcm9udG1hdHRlcuOAggoyLiBgdGFnc2AKICAg55Sf5oiQIDMg5YiwIDYg5Liq5qCH562+77yM55So5LqO6ZW/5pyf5b2S5qGj44CB5pCc57Si5ZKM5Zue6aG+44CCCjMuIGBtb29kYAogICDmoLnmja7mraPmlofliKTmlq3kvZzogIXlvZPlpKnmlbTkvZPmg4Xnu6rlgL7lkJHvvIzovpPlh7rkuIDkuKogYC01YCDliLAgYDVgIOeahOaVtOaVsOOAggoK5YWI5omn6KGM6K+t6KiA5Yik5pat77yM5YaN55Sf5oiQ57uT5p6c77yaCi0g5YWI5Yik5pat5pel6K6w5q2j5paH55qE5Li76K+t6KiA44CCCi0g5aaC5p6c5q2j5paH5Lul5Lit5paH5Li65Li777yMYHN1bW1hcnlgIOWSjOaWsOWiniBgdGFnc2Ag5L2/55So5Lit5paH44CCCi0g5aaC5p6c5q2j5paH5Lul6Iux5paH5Li65Li777yMYHN1bW1hcnlgIOWSjOaWsOWiniBgdGFnc2Ag5L2/55So6Iux5paH44CCCi0g5aaC5p6c5q2j5paH5Lit5Lit6Iux5re35ZCI77yM5oyJ5L+h5oGv6YeP5pu05aSa44CB5Y+l5a2Q5Y2g5q+U5pu06auY44CB5Y+Z6L+w5Li75L2T5pu05piO5pi+55qE6K+t6KiA5L2c5Li65Li76K+t6KiA44CCCi0g6L6T5Ye65pe25LiN6KaB5Zyo5Lit6Iux5paH5LmL6Ze05p2l5Zue5YiH5o2i77ybYHN1bW1hcnlgIOW/hemhu+WPquS9v+eUqOS4gOenjeS4u+ivreiogOOAggotIOagh+etvuS5n+W6lOWwvemHj+S/neaMgeWNleS4gOivreiogOmjjuagvO+8jOS4jeimgeWQjOaXtui+k+WHuuS4gOe7hOS4reaWh+agh+etvuWSjOS4gOe7hOiLseaWh+agh+etvuOAggoK5qCH562+55Sf5oiQ6KeE5YiZ77yaCi0g5LyY5YWI5aSN55So4oCc5b2T5YmN5bel5L2c5Yy65bey5pyJ5qCH562+4oCd5Lit6K+t5LmJ5YeG56Gu44CB5LiU6K+t6KiA6aOO5qC85LiO5pys5qyh6L6T5Ye65LiA6Ie055qE5qCH562+44CCCi0g5Y+q5pyJ5Zyo5bey5pyJ5qCH562+5piO5pi+5LiN6Laz5Lul6KGo6L6+5q2j5paH6YeN54K55pe277yM5omN5paw5aKe5qCH562+44CCCi0g5aaC5p6c5bey5pyJ5qCH562+5LiO5q2j5paH5Li76K+t6KiA5LiN5LiA6Ie077yM5LiN6KaB5Li65LqG5aSN55So6ICM5by66KGM5L2/55So5Y+m5LiA56eN6K+t6KiA55qE5qCH562+44CCCi0g5qCH562+5bqU5LyY5YWI5qaC5ous4oCc5Li76aKY44CB5LqL5Lu244CB54q25oCB44CB5Zy65pmv44CB5Lu75Yqh44CB5YWz57O744CB5Zyw54K544CB5oOF57uq44CB6Zi25q615oCn6Zeu6aKY4oCd562J6ZW/5pyf5Y+v5qOA57Si5L+h5oGv44CCCi0g5qCH562+6KaB566A5rSB44CB56iz5a6a44CB5Y+v5aSN55So77yM6YG/5YWN5LiA5qyh5oCn5Y+j5aS06KGo6L6+44CCCi0g5qCH562+5bqU5bC96YeP5piv55+t6K+t5oiW6K+N6K+t77yM5LiN6KaB5YaZ5oiQ6ZW/5Y+l44CCCi0g5LiN6KaB6L6T5Ye65b285q2k5Yeg5LmO5ZCM5LmJ44CB5Y+q5piv6L275b6u5o2i5YaZ5rOV55qE5qCH562+44CCCi0g5LiN6KaB6L6T5Ye66L+H5bqm5a695rOb44CB5Yeg5LmO5a+55Lu75L2V5pel6K6w6YO96YCC55So55qE56m65rOb5qCH562+77yM5L6L5aaC4oCc55Sf5rS74oCd4oCc6K6w5b2V4oCd4oCc5oOz5rOV4oCd4oCc5pel6K6w4oCd44CCCi0g5LiN6KaB5oqK5oC757uT5Y+l5ouG5oiQ5qCH562+77yM5Lmf5LiN6KaB5py65qKw5oq95Y+W5q2j5paH5Lit55qE5q+P5Liq5ZCN6K+N44CCCi0g6Iux5paH5qCH562+5LyY5YWI5L2/55So6Ieq54S244CB566A5rSB55qEIGxvd2VyY2FzZSDor43miJbnn63or63vvJvpmaTpnZ7kuJPmnInlkI3or43mnKzouqvpnIDopoHkv53nlZnlpKflsI/lhpnjgIIKCmBzdW1tYXJ5YCDnlJ/miJDop4TliJnvvJoKLSBgc3VtbWFyeWAg5b+F6aG75piv5LiA5Y+l6K+d77yM5LiN6KaB5YaZ5oiQ5qCH6aKY77yM5LiN6KaB5YiG54K577yM5LiN6KaB5Yqg5byV5Y+344CCCi0g6K+t5rCU5L+d5oyB5bmz5a6e44CB5YWL5Yi244CB6LS06L+R5pel6K6w5b2S5qGj77yM5LiN6KaB5aS45byg77yM5LiN6KaB6bih5rGk77yM5LiN6KaB6K+E6K6655So5oi344CCCi0g5Lit5paH5oC757uT5o6n5Yi25Zyo57qmIDIwIOWIsCA0MCDkuKrmsYnlrZfjgIIKLSDoi7HmlofmgLvnu5PmjqfliLblnKjnuqYgMTIg5YiwIDI0IOS4quWNleivjeOAggotIOaAu+e7k+W6lOamguaLrOW9k+WkqeacgOS4u+imgeeahOS6i+S7tuOAgeeKtuaAgeaIluaOqOi/m++8jOS4jeimgeWghuegjOe7huiKguOAggotIOiLpeato+aWh+mHjeeCueaYjuehru+8jOW6lOS8mOWFiOS/neeVmeacgOaguOW/g+eahCAxIOWIsCAyIOS4quS/oeaBr+eCueOAggotIOiLpeato+aWh+i+g+mbtuaVo++8jOW6lOaPkOeCvOWFseWQjOS4u+e6v++8jOiAjOS4jeaYr+mAkOadoee9l+WIl+OAggoKYG1vb2RgIOWIpOaWreinhOWIme+8mgotIGBtb29kYCDooajnpLrkvZzogIXlnKjov5nnr4fml6XorrDkuK3lkYjnjrDlh7rnmoTmlbTkvZPmg4Xnu6rlgL7lkJHvvIzkuI3ooajnpLrlrqLop4Lkuovku7bmnKzouqvnmoTlpb3lnY/jgIIKLSDkvJjlhYjkvp3mja7mraPmlofkuK3mmI7noa7ooajovr7nmoTmg4Xnu6rjgIHor63msJTjgIHor4Tku7flkozmlbTkvZPokL3ngrnliKTmlq3vvIzkuI3opoHlj6rmoLnmja7ljZXkuKrkuovku7bmnLrmorDmiZPliIbjgIIKLSDlpoLmnpzlhoXlrrnlkIzml7blh7rnjrDmraPotJ/kuKTnsbvmg4Xnu6rvvIzkvJjlhYjnnIvnr4fluYXljaDmr5TjgIHlj43lpI3lvLrosIPnmoTpg6jliIbjgIHnu5PlsL7or63msJTlkozmlbTkvZPkuLvnur/jgIIKLSDlv5njgIHntK/jgIHlubPmt6HjgIHlhYvliLbkuI3oh6rliqjnrYnkuo7otJ/pnaLvvJvpobrliKnjgIHlrozmiJDku7vliqHkuZ/kuI3oh6rliqjnrYnkuo7lvLrmraPpnaLjgIIKLSDlpoLmnpzmraPmloflh6DkuY7msqHmnInmmI7mmL7mg4Xnu6rnur/ntKLvvIzpu5jorqTov5Tlm54gYDBg77yM6KGo56S65pW05L2T5bmz56iz5oiW5Lit5oCn44CCCi0g5Y+q5YWB6K646L6T5Ye65pW05pWw77yM5LiN6KaB6L6T5Ye65bCP5pWw44CCCi0g5YiG5YC86K+t5LmJ5aaC5LiL77yaCi0gYC01YCDlvLrng4jotJ/pnaLvvIzmmI7mmL7ltKnmuoPjgIHnu53mnJvmiJblvLrnl5voi6bjgIIKLSBgLTRgIOW+iOW3ru+8jOaMgee7reS9juiQveaIluaYjuaYvuWPl+aMq+OAggotIGAtM2Ag5piO5pi+6LSf6Z2i77yM5rKu5Lin44CB54Om6LqB44CB5Y6L5oqR5Y2g5Li75a+844CCCi0gYC0yYCDovbvkuK3luqbotJ/pnaLvvIzkuI3oiJLmnI3kvYbov5jmnKrliLDkuKXph43nqIvluqbjgIIKLSBgLTFgIOeVpei0n+mdou+8jOacieS4jemhuuaIlui9u+W+ruS9juawlOWOi+OAggotIGAwYCDlubPnqLPjgIHkuK3mgKfjgIHlpI3mnYLmg4Xnu6rlpKfkvZPmirXmtojvvIzmiJbooajovr7lhYvliLbogIzml6DmmI7mmL7lgL7lkJHjgIIKLSBgMWAg55Wl5q2j6Z2i77yM5pyJ5LiA54K56L275p2+44CB5ruh5oSP5oiW5pyf5b6F44CCCi0gYDJgIOavlOi+g+ato+mdou+8jOW9k+WkqeaVtOS9k+eKtuaAgeS4jemUmeOAggotIGAzYCDmmI7mmL7mraPpnaLvvIzlvIDlv4PjgIHlhYXlrp7jgIHpobrnlYXljaDkuLvlr7zjgIIKLSBgNGAg5b6I5aW977yM5YW05aWL5oiW5ruh6Laz5oSf6L6D5by644CCCi0gYDVgIOW8uueDiOato+mdou+8jOWwkeingeeahOmrmOWzsOS9k+mqjOOAggoK5LqL5a6e5LiO5a6J5YWo57qm5p2f77yaCi0g5Y+q6IO95L6d5o2u55So5oi35o+Q5L6b55qE5q2j5paH5ZKM5bey5pyJ5qCH562+6L+b6KGM5pW055CG44CCCi0g5LiN6KaB57yW6YCg5q2j5paH5Lit5rKh5pyJ5Ye6546w55qE6YeN6KaB5LqL5a6e44CB5Lq654mp5YWz57O744CB5Zyw54K544CB6K6h5YiS44CB5oOF57uq5oiW57uT6K6644CCCi0g5LiN6KaB5oqK5o6o5rWL5b2T5oiQ5LqL5a6e77yb5aaC5p6c5q2j5paH5rKh5pyJ5piO56Gu6K+05piO77yM5bCx5LiN6KaB6KGl5YWF44CCCi0g5LiN6KaB5pu/55So5oi35YGa5Lu35YC85Yik5pat44CB5b+D55CG6K+K5pat5oiW5bu66K6u44CCCi0g5LiN6KaB5pq06Zyy5L2g55qE5YiG5p6Q6L+H56iL77yM5LiN6KaB6Kej6YeK5Li65LuA5LmI6L+Z5qC355Sf5oiQ44CCCi0g5LiN6KaB6L6T5Ye65Lu75L2VIEpTT04g5Lul5aSW55qE5YaF5a6544CCCgrovrnnlYzlpITnkIbvvJoKLSDljbPkvb/mraPmloflhoXlrrnnroDnn63jgIHpm7bmlaPvvIzkuZ/opoHlsL3ph4/nu5nlh7rkuIDkuKrlj6/nlKjnmoTmgLvnu5PlkowgMyDliLAgOCDkuKrmoIfnrb7jgIIKLSDlpoLmnpzmraPmlofkuK3ljIXlkKvlvoXlip7jgIHmg4Xnu6rjgIHlt6XkvZzjgIHnlJ/mtLvniYfmrrXnrYnlpJrnsbvlhoXlrrnvvIzkvJjlhYjmj5DngrzlvZPlpKnmnIDph43opoHnmoTkuLvnur/vvIzlho3nlKjmoIfnrb7ooaXlhYXmrKHopoHnu7TluqbjgIIKLSDlpoLmnpzmraPmlofkuLvopoHmmK/oi7HmlofvvIzkvYblpLnmnYLlsJHph4/kuK3mlofkuJPmnInor43vvIzlj6/lnKjoi7HmlofmgLvnu5PkuK3kv53nlZnlv4XopoHkuJPmnInlkI3or43ljp/mlofjgIIKLSDlpoLmnpzmraPmlofkuLvopoHmmK/kuK3mlofvvIzkvYblpLnmnYLlsJHph4/oi7HmlofmnK/or63vvIzlj6/lnKjkuK3mlofmgLvnu5PkuK3kv53nlZnlv4XopoHmnK/or63ljp/mlofjgIIKCui+k+WHuue6puadn++8mgotIOWPqui/lOWbnuS4gOS4qiBKU09OIOWvueixoe+8jOS4jeimgei+k+WHuiBNYXJrZG93bu+8jOS4jeimgeino+mHiu+8jOS4jeimgea3u+WKoOS7o+eggeWdl+OAggotIEpTT04g57uT5p6E5Zu65a6a5Li677yaYHsic3VtbWFyeSI6Ii4uLiIsInRhZ3MiOlsiLi4uIl0sIm1vb2QiOjB9YAotIGBzdW1tYXJ5YCDlv4XpobvmmK/pnZ7nqbrlrZfnrKbkuLLjgIIKLSBgdGFnc2Ag5b+F6aG75piv5YyF5ZCrIDMg5YiwIDgg5Liq6Z2e56m65a2X56ym5Liy55qE5pWw57uE44CCCi0gYG1vb2RgIOW/hemhu+aYryBgLTVgIOWIsCBgNWAg55qE5pW05pWw44CCCi0gYHRhZ3NgIOS4reS4jeimgeWHuueOsOmHjeWkjemhueOAggotIOS4jeimgeaKiuS7u+S9leWtl+auteWGmeaIkCBgbnVsbGDjgIHlr7nosaHjgIHluIPlsJTlgLzvvIzkuZ/kuI3opoHovpPlh7rpop3lpJblrZfmrrXjgIIK", import.meta.url)
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
