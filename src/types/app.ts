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
  systemEnabled: boolean
  emailEnabled: boolean
  reminderTime: string
  email: EmailNotificationConfig
}

export interface EmailNotificationConfig {
  smtpHost: string
  smtpPort: number
  secure: boolean
  username: string
  fromEmail: string
  recipientEmail: string
}

export interface EmailNotificationSecretStatus {
  hasAuthCode: boolean
  isConfigured: boolean
}

export interface WindowBoundsConfig {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowStateConfig {
  bounds: WindowBoundsConfig | null
  isMaximized: boolean
  isFullScreen: boolean
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
    windowState: WindowStateConfig
    frontmatterVisibility: FrontmatterVisibilityConfig
  }
  ai: AiSettings
}

export interface AppBootstrap {
  config: AppConfig
  emailNotificationStatus: EmailNotificationSecretStatus
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
  systemEnabled: boolean
  emailEnabled: boolean
  reminderTime: string
  email: EmailNotificationConfig
}

export interface SaveEmailNotificationAuthCodeInput {
  authCode: string
}

export interface WindowDirtyStateInput {
  isDirty: boolean
}

export interface OpenExternalLinkInput {
  url: string
}
