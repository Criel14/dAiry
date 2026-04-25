import path from 'node:path'
import { app } from 'electron'
import { mkdir, stat, readFile, writeFile } from 'node:fs/promises'
import type { AiSettings, SaveAiSettingsInput } from '../../src/types/ai'
import type {
  AppTheme,
  AppConfig,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityConfig,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  LaunchOnStartupPreferenceInput,
  NotificationConfig,
  NotificationPreferenceInput,
  ThemePreferenceInput,
  WindowCloseBehavior,
  WindowCloseBehaviorPreferenceInput,
  WindowZoomPreferenceInput,
} from '../../src/types/app'
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from './constants'
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

function normalizeTheme(rawValue: unknown): AppTheme {
  return rawValue === 'light' || rawValue === 'dark' || rawValue === 'system'
    ? rawValue
    : 'system'
}

function normalizeWindowCloseBehavior(rawValue: unknown): WindowCloseBehavior {
  return rawValue === 'quit' ? 'quit' : 'tray'
}

function normalizeLaunchOnStartup(rawValue: unknown) {
  return rawValue !== false
}

function normalizeNotificationReminderTime(rawValue: unknown) {
  if (typeof rawValue !== 'string') {
    return DEFAULT_NOTIFICATION_CONFIG.reminderTime
  }

  const normalizedValue = rawValue.trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalizedValue)
    ? normalizedValue
    : DEFAULT_NOTIFICATION_CONFIG.reminderTime
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

function normalizeNotificationConfig(
  rawValue: Partial<NotificationConfig> | null | undefined,
): NotificationConfig {
  return {
    enabled: rawValue?.enabled === true,
    reminderTime: normalizeNotificationReminderTime(rawValue?.reminderTime),
  }
}

function normalizeReportExportConfig(rawValue: AppConfig['reportExport'] | null | undefined) {
  return {
    lastDirectory: typeof rawValue?.lastDirectory === 'string' ? rawValue.lastDirectory : null,
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
  const theme = normalizeTheme(config.ui?.theme)
  const zoomFactor = normalizeUiZoomFactor(config.ui?.zoomFactor)
  const journalHeatmapEnabled = config.ui?.journalHeatmapEnabled === true
  const dayStartHour = normalizeDayStartHour(config.ui?.dayStartHour)
  const closeBehavior = normalizeWindowCloseBehavior(config.ui?.closeBehavior)
  const launchOnStartup = normalizeLaunchOnStartup(config.ui?.launchOnStartup)
  const notification = normalizeNotificationConfig(config.ui?.notification)
  const frontmatterVisibility = normalizeFrontmatterVisibility(config.ui?.frontmatterVisibility)
  const ai = normalizeAiSettings(config.ai)
  const reportExport = normalizeReportExportConfig(config.reportExport)

  return {
    lastOpenedWorkspace:
      typeof config.lastOpenedWorkspace === 'string' ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    reportExport,
    ui: {
      theme,
      zoomFactor,
      journalHeatmapEnabled,
      dayStartHour,
      closeBehavior,
      launchOnStartup,
      notification,
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
  const lastReportExportDirectory =
    config.reportExport.lastDirectory && (await isExistingDirectory(config.reportExport.lastDirectory))
      ? config.reportExport.lastDirectory
      : null

  return {
    ...config,
    lastOpenedWorkspace,
    recentWorkspaces: nextRecentWorkspaces,
    reportExport: {
      ...config.reportExport,
      lastDirectory: lastReportExportDirectory,
    },
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
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
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

export async function setThemePreference(input: ThemePreferenceInput): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      theme: normalizeTheme(input.theme),
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

export async function setWindowCloseBehavior(
  input: WindowCloseBehaviorPreferenceInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      closeBehavior: normalizeWindowCloseBehavior(input.behavior),
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setLaunchOnStartupPreference(
  input: LaunchOnStartupPreferenceInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      launchOnStartup: normalizeLaunchOnStartup(input.enabled),
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
}

export async function setNotificationPreference(
  input: NotificationPreferenceInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      notification: normalizeNotificationConfig(input),
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

export async function setLastReportExportDirectory(directoryPath: string): Promise<AppConfig> {
  const normalizedDirectoryPath = directoryPath.trim()
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    reportExport: {
      ...currentConfig.reportExport,
      lastDirectory: normalizedDirectoryPath || null,
    },
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
