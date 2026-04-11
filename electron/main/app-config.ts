import path from 'node:path'
import { app } from 'electron'
import { mkdir, stat, readFile, writeFile } from 'node:fs/promises'
import type {
  AppConfig,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityConfig,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
} from '../../src/types/dairy'
import { DEFAULT_APP_CONFIG } from './constants'

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

function normalizeFrontmatterVisibility(
  rawValue: Partial<FrontmatterVisibilityConfig> | null | undefined,
): FrontmatterVisibilityConfig {
  return {
    weather: rawValue?.weather !== false,
    location: rawValue?.location !== false,
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
  const journalHeatmapEnabled = config.ui?.journalHeatmapEnabled === true
  const dayStartHour = normalizeDayStartHour(config.ui?.dayStartHour)
  const frontmatterVisibility = normalizeFrontmatterVisibility(config.ui?.frontmatterVisibility)

  return {
    lastOpenedWorkspace:
      typeof config.lastOpenedWorkspace === 'string' ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
      journalHeatmapEnabled,
      dayStartHour,
      frontmatterVisibility,
    },
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
