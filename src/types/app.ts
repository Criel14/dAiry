import type { AiSettings } from './ai'

export type AppTheme = 'system' | 'light' | 'dark'
export type WindowCloseBehavior = 'tray' | 'quit'

export interface FrontmatterVisibilityConfig {
  weather: boolean
  location: boolean
  mood: boolean
  summary: boolean
  tags: boolean
}

export interface NotificationConfig {
  enabled: boolean
  reminderTime: string
}

export interface AppConfig {
  lastOpenedWorkspace: string | null
  recentWorkspaces: string[]
  reportExport: {
    lastDirectory: string | null
  }
  ui: {
    theme: AppTheme
    zoomFactor: number
    journalHeatmapEnabled: boolean
    dayStartHour: number
    closeBehavior: WindowCloseBehavior
    launchOnStartup: boolean
    notification: NotificationConfig
    frontmatterVisibility: FrontmatterVisibilityConfig
  }
  ai: AiSettings
}

export interface AppBootstrap {
  config: AppConfig
}

export interface JournalHeatmapPreferenceInput {
  enabled: boolean
}

export interface ThemePreferenceInput {
  theme: AppTheme
}

export interface WindowZoomPreferenceInput {
  zoomFactor: number
}

export interface FrontmatterVisibilityInput {
  visibility: FrontmatterVisibilityConfig
}

export interface DayStartHourPreferenceInput {
  hour: number
}

export interface WindowCloseBehaviorPreferenceInput {
  behavior: WindowCloseBehavior
}

export interface LaunchOnStartupPreferenceInput {
  enabled: boolean
}

export interface NotificationPreferenceInput {
  enabled: boolean
  reminderTime: string
}

export interface WindowDirtyStateInput {
  isDirty: boolean
}

export interface OpenExternalLinkInput {
  url: string
}
