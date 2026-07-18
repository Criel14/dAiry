import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AiSettings } from '../../src/types/ai'
import type { AppConfig, EmailNotificationConfig, NotificationConfig } from '../../src/types/app'
import type { JournalEntryMetadata } from '../../src/types/journal'
import { DEFAULT_WINDOW_ZOOM_FACTOR } from '../../src/shared/window-zoom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const APP_ICON_NAME = process.platform === 'win32' ? 'app.ico' : 'app.png'
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const APP_ICON_BASE_PATH = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'build', 'icons')
  : path.join(process.resourcesPath, 'build', 'icons')
export const APP_ICON_PATH = path.join(APP_ICON_BASE_PATH, APP_ICON_NAME)
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

export { IPC_CHANNELS } from '../../src/shared/ipc-channels'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerType: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  timeoutMs: 30_000,
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

export const DEFAULT_APP_CONFIG: AppConfig = {
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
}

export const EMPTY_METADATA: JournalEntryMetadata = {
  weather: '',
  location: '',
  mood: 0,
  summary: '',
  tags: [],
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
