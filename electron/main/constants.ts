import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

export {
  DAILY_CONTEXT_DAYS_OPTIONS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_CONFIG,
  DEFAULT_DAILY_CONTEXT_DAYS,
  DEFAULT_EMAIL_NOTIFICATION_CONFIG,
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_PROFILE_REFRESH_INTERVAL,
  DEFAULT_TAG_OPTIONS,
  DEFAULT_WEATHER_OPTIONS,
  EMPTY_METADATA,
  PROFILE_REFRESH_INTERVAL_OPTIONS,
} from '../../src/shared/defaults'
