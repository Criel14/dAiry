import path from 'node:path'
import { app } from 'electron'
import { mkdir, stat, readFile, writeFile } from 'node:fs/promises'
import type {
  AiSettings,
  AppConfig,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityConfig,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  SaveAiSettingsInput,
  WindowZoomPreferenceInput,
} from '../../src/types/dairy'
import { DEFAULT_AI_SETTINGS, DEFAULT_APP_CONFIG } from './constants'
import { normalizeWindowZoomFactor } from '../../src/shared/window-zoom'

function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function normalizeDayStartHour(rawValue: unknown) {
  if (typeof rawValue !== 'number' || !Number.isInteger(rawValue)) {
    return 0
  }

  if (rawValue < 0 || rawValue > 6) {
    return 0
  }

  return rawValue
}

function normalizeUiZoomFactor(rawValue: unknown) {
  return normalizeWindowZoomFactor(rawValue)
}

function normalizeTimeoutMs(rawValue: unknown) {
  void rawValue
  return DEFAULT_AI_SETTINGS.timeoutMs
}

function normalizeBaseURL(rawValue: unknown, fallbackBaseURL = DEFAULT_AI_SETTINGS.baseURL) {
  if (typeof rawValue !== 'string') {
    return fallbackBaseURL
  }

  const normalizedValue = rawValue.trim().replace(/\/+$/, '')
  return normalizedValue || fallbackBaseURL
}

function normalizeModel(rawValue: unknown, fallbackModel = DEFAULT_AI_SETTINGS.model) {
  if (typeof rawValue !== 'string') {
    return fallbackModel
  }

  const normalizedValue = rawValue.trim()
  return normalizedValue || fallbackModel
}

function normalizeProviderType(rawValue: unknown): AiSettings['providerType'] {
  return rawValue === 'openai' ||
    rawValue === 'deepseek' ||
    rawValue === 'alibaba' ||
    rawValue === 'openai-compatible'
    ? rawValue
    : DEFAULT_AI_SETTINGS.providerType
}

export function normalizeAiSettings(rawValue: Partial<AiSettings> | null | undefined): AiSettings {
  const providerType = normalizeProviderType(rawValue?.providerType)
  const providerDefaults = getDefaultAiSettings(providerType)

  return {
    providerType,
    baseURL: normalizeBaseURL(rawValue?.baseURL, providerDefaults.baseURL),
    model: normalizeModel(rawValue?.model, providerDefaults.model),
    timeoutMs: normalizeTimeoutMs(rawValue?.timeoutMs),
  }
}

function normalizeFrontmatterVisibility(
  rawValue: Partial<FrontmatterVisibilityConfig> | null | undefined,
): FrontmatterVisibilityConfig {
  return {
    weather: rawValue?.weather !== false,
    location: rawValue?.location !== false,
    mood: rawValue?.mood !== false,
    summary: rawValue?.summary !== false,
    tags: rawValue?.tags !== false,
  }
}

function normalizeAppConfig(rawValue: unknown): AppConfig {
  if (!rawValue || typeof rawValue !== 'object') {
    return DEFAULT_APP_CONFIG
  }

  const config = rawValue as Partial<AppConfig>
  const recentWorkspaces = Array.isArray(config.recentWorkspaces)
    ? config.recentWorkspaces.filter((item): item is string => typeof item === 'string')
    : []
  const theme =
    config.ui?.theme === 'light' || config.ui?.theme === 'dark' || config.ui?.theme === 'system'
      ? config.ui.theme
      : 'system'
  const zoomFactor = normalizeUiZoomFactor(config.ui?.zoomFactor)
  const journalHeatmapEnabled = config.ui?.journalHeatmapEnabled === true
  const dayStartHour = normalizeDayStartHour(config.ui?.dayStartHour)
  const frontmatterVisibility = normalizeFrontmatterVisibility(config.ui?.frontmatterVisibility)
  const ai = normalizeAiSettings(config.ai)

  return {
    lastOpenedWorkspace:
      typeof config.lastOpenedWorkspace === 'string' ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
      zoomFactor,
      journalHeatmapEnabled,
      dayStartHour,
      frontmatterVisibility,
    },
    ai,
  }
}

async function isExistingDirectory(targetPath: string) {
  try {
    const targetStat = await stat(targetPath)
    return targetStat.isDirectory()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }

    throw error
  }
}

async function sanitizeAppConfig(config: AppConfig): Promise<AppConfig> {
  const validRecentWorkspaces: string[] = []

  for (const workspacePath of config.recentWorkspaces) {
    if (await isExistingDirectory(workspacePath)) {
      validRecentWorkspaces.push(workspacePath)
    }
  }

  const lastOpenedWorkspace =
    config.lastOpenedWorkspace && (await isExistingDirectory(config.lastOpenedWorkspace))
      ? config.lastOpenedWorkspace
      : null

  const nextRecentWorkspaces =
    lastOpenedWorkspace && !validRecentWorkspaces.includes(lastOpenedWorkspace)
      ? [lastOpenedWorkspace, ...validRecentWorkspaces]
      : validRecentWorkspaces

  return {
    ...config,
    lastOpenedWorkspace,
    recentWorkspaces: nextRecentWorkspaces,
  }
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const fileContent = await readFile(getConfigFilePath(), 'utf-8')
    const normalizedConfig = normalizeAppConfig(JSON.parse(fileContent))
    return sanitizeAppConfig(normalizedConfig)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_APP_CONFIG
    }

    throw error
  }
}

export async function writeAppConfig(config: AppConfig) {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf-8')
}

export function getDefaultAiSettings(
  providerType: AiSettings['providerType'],
): AiSettings {
  switch (providerType) {
    case 'openai':
      return {
        providerType,
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs,
      }
    case 'deepseek':
      return {
        providerType,
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs,
      }
    case 'alibaba':
      return {
        providerType,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        timeoutMs: DEFAULT_AI_SETTINGS.timeoutMs,
      }
    default:
      return {
        ...DEFAULT_AI_SETTINGS,
      }
  }
}

export async function setJournalHeatmapEnabled(
  input: JournalHeatmapPreferenceInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      journalHeatmapEnabled: input.enabled,
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setWindowZoomFactor(input: WindowZoomPreferenceInput): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      zoomFactor: normalizeUiZoomFactor(input.zoomFactor),
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setDayStartHour(input: DayStartHourPreferenceInput): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      dayStartHour: normalizeDayStartHour(input.hour),
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setFrontmatterVisibility(
  input: FrontmatterVisibilityInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      frontmatterVisibility: normalizeFrontmatterVisibility(input.visibility),
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setAiSettings(input: SaveAiSettingsInput): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ai: normalizeAiSettings(input),
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export function buildWorkspaceConfig(workspacePath: string, currentConfig: AppConfig) {
  const nextRecentWorkspaces = [
    workspacePath,
    ...currentConfig.recentWorkspaces.filter((item) => item !== workspacePath),
  ]

  return {
    ...currentConfig,
    lastOpenedWorkspace: workspacePath,
    recentWorkspaces: nextRecentWorkspaces.slice(0, 8),
  }
}
