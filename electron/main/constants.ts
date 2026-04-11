import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppConfig, JournalEntryMetadata } from '../../src/types/dairy'

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
  setJournalHeatmapEnabled: 'app:set-journal-heatmap-enabled',
  setDayStartHour: 'app:set-day-start-hour',
  setFrontmatterVisibility: 'app:set-frontmatter-visibility',
  setWindowDirtyState: 'app:set-window-dirty-state',
  chooseWorkspace: 'workspace:choose',
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
} as const

export const DEFAULT_APP_CONFIG: AppConfig = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: 'system',
    journalHeatmapEnabled: false,
    dayStartHour: 0,
    frontmatterVisibility: {
      weather: true,
      location: true,
      summary: true,
      tags: true,
    },
  },
}

export const EMPTY_METADATA: JournalEntryMetadata = {
  weather: '',
  location: '',
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
