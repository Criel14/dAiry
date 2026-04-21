import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AiSettings } from '../../src/types/ai'
import type { AppConfig } from '../../src/types/app'
import type { JournalEntryMetadata } from '../../src/types/journal'
import { DEFAULT_WINDOW_ZOOM_FACTOR } from '../../src/shared/window-zoom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const APP_ICON_NAME = process.platform === 'win32' ? 'app.ico' : 'app.png'
export const APP_ICON_PATH = path.join(process.env.APP_ROOT, 'build', 'icons', APP_ICON_NAME)

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

export const IPC_CHANNELS = {
  getBootstrap: 'app:get-bootstrap',
  getThemePreference: 'app:get-theme-preference',
  getAiSettingsStatus: 'app:get-ai-settings-status',
  saveAiSettings: 'app:save-ai-settings',
  saveAiApiKey: 'app:save-ai-api-key',
  getAiContext: 'app:get-ai-context',
  saveAiContext: 'app:save-ai-context',
  setThemePreference: 'app:set-theme-preference',
  setWindowZoomFactor: 'app:set-window-zoom-factor',
  windowZoomChanged: 'app:window-zoom-changed',
  setJournalHeatmapEnabled: 'app:set-journal-heatmap-enabled',
  setDayStartHour: 'app:set-day-start-hour',
  setFrontmatterVisibility: 'app:set-frontmatter-visibility',
  setWindowDirtyState: 'app:set-window-dirty-state',
  openExternalLink: 'app:open-external-link',
  openDevTools: 'app:open-dev-tools',
  chooseWorkspace: 'workspace:choose',
  openWorkspaceFolder: 'workspace:open-folder',
  getWorkspaceTags: 'workspace:get-tags',
  getWorkspaceWeatherOptions: 'workspace:get-weather-options',
  getWorkspaceLocationOptions: 'workspace:get-location-options',
  setWorkspaceTags: 'workspace:set-tags',
  setWorkspaceWeatherOptions: 'workspace:set-weather-options',
  setWorkspaceLocationOptions: 'workspace:set-location-options',
  readJournalEntry: 'journal:read-entry',
  createJournalEntry: 'journal:create-entry',
  saveJournalEntryBody: 'journal:save-entry-body',
  saveJournalEntryMetadata: 'journal:save-entry-metadata',
  getJournalMonthActivity: 'journal:get-month-activity',
  generateDailyInsights: 'journal:generate-daily-insights',
  generateRangeReport: 'report:generate-range-report',
  getRangeReport: 'report:get-range-report',
  listRangeReports: 'report:list-range-reports',
  exportRangeReportPng: 'report:export-png',
  getReportExportPayload: 'report:get-export-payload',
  notifyReportExportReady: 'report:export-ready',
} as const

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerType: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  timeoutMs: 30_000,
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
