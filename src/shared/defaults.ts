import type { AiSettings } from '../types/ai'
import type {
  AppConfig,
  EmailNotificationConfig,
  NotificationConfig,
  FrontmatterVisibilityConfig,
} from '../types/app'
import type { JournalEntryMetadata } from '../types/journal'
import { DEFAULT_WINDOW_ZOOM_FACTOR } from './window-zoom'

export const DEFAULT_DAILY_CONTEXT_DAYS = 7
export const DEFAULT_PROFILE_REFRESH_INTERVAL = 7
export const DAILY_CONTEXT_DAYS_OPTIONS: readonly number[] = [3, 5, 7, 10, 14]
export const PROFILE_REFRESH_INTERVAL_OPTIONS: readonly number[] = [3, 5, 7, 10, 14, 21, 30]

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerType: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  timeoutMs: 60_000,
  dailyContextDays: DEFAULT_DAILY_CONTEXT_DAYS,
  profileRefreshIntervalDays: DEFAULT_PROFILE_REFRESH_INTERVAL,
}

export const DEFAULT_EMAIL_NOTIFICATION_CONFIG: EmailNotificationConfig = {
  providerType: 'qq',
  smtpHost: 'smtp.qq.com',
  smtpPort: 465,
  encryption: 'ssl',
  username: '',
  fromEmail: '',
  recipientEmail: '',
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  systemEnabled: false,
  emailEnabled: false,
  reminderTime: '21:30',
  email: DEFAULT_EMAIL_NOTIFICATION_CONFIG,
}

export function createDefaultAppConfig(): AppConfig {
  return {
    lastOpenedWorkspace: null,
    recentWorkspaces: [],
    reportExport: {
      lastDirectory: null,
    },
    ui: {
      theme: 'system',
      zoomFactor: DEFAULT_WINDOW_ZOOM_FACTOR,
      journalHeatmapEnabled: false,
      dayStartHour: 0,
      closeBehavior: 'tray',
      launchOnStartup: true,
      notification: DEFAULT_NOTIFICATION_CONFIG,
      windowState: {
        bounds: null,
        isMaximized: false,
        isFullScreen: false,
      },
      frontmatterVisibility: {
        weather: true,
        location: true,
        mood: true,
        summary: true,
        tags: true,
      },
    },
    ai: DEFAULT_AI_SETTINGS,
    mcp: {
      enabled: false,
      port: 9123,
    },
  }
}

export const DEFAULT_APP_CONFIG = createDefaultAppConfig()

export const EMPTY_METADATA: JournalEntryMetadata = {
  weather: '',
  location: '',
  mood: 0,
  summary: '',
  tags: [],
}

export function createDefaultFrontmatterVisibility(): FrontmatterVisibilityConfig {
  return {
    weather: true,
    location: true,
    mood: true,
    summary: true,
    tags: true,
  }
}

export function createDefaultNotificationConfig(): NotificationConfig {
  return {
    systemEnabled: false,
    emailEnabled: false,
    reminderTime: '21:30',
    email: {
      providerType: 'qq',
      smtpHost: 'smtp.qq.com',
      smtpPort: 465,
      encryption: 'ssl',
      username: '',
      fromEmail: '',
      recipientEmail: '',
    },
  }
}

export const DEFAULT_WEATHER_OPTIONS = [
  '晴',
  '多云',
  '阴',
  '小雨',
  '大雨',
  '雷阵雨',
  '小雪',
  '大雪',
  '雾',
]

export const DEFAULT_LOCATION_OPTIONS = ['学校', '公司', '家']

export const DEFAULT_TAG_OPTIONS = ['上班', '加班', '原神', '杀戮尖塔']
