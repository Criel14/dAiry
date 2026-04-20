import { app, BrowserWindow, Menu, dialog } from 'electron'
import path from 'node:path'
import {
  APP_ICON_PATH,
  IPC_CHANNELS,
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL,
} from './constants'
import { readAppConfig, setWindowZoomFactor as persistWindowZoomFactor } from './app-config'
import {
  DEFAULT_WINDOW_ZOOM_FACTOR,
  getNextWindowZoomFactor,
  normalizeWindowZoomFactor,
} from '../../src/shared/window-zoom'

let win: BrowserWindow | null = null
let isWindowDirty = false
let isForceClosingWindow = false

export function getMainWindow() {
  return win
}

export function setWindowDirtyState(isDirty: boolean) {
  isWindowDirty = isDirty
}

export function openMainWindowDevTools() {
  if (!win) {
    return
  }

  if (win.webContents.isDevToolsOpened()) {
    win.webContents.focus()
    return
  }

  win.webContents.openDevTools({ mode: 'detach' })
}

function applyWindowZoomFactor(zoomFactor: number) {
  if (!win) {
    return
  }

  win.webContents.setZoomFactor(normalizeWindowZoomFactor(zoomFactor))
}

function notifyWindowZoomChanged(zoomFactor: number) {
  if (!win || win.isDestroyed()) {
    return
  }

  win.webContents.send(IPC_CHANNELS.windowZoomChanged, {
    zoomFactor: normalizeWindowZoomFactor(zoomFactor),
  })
}

function getZoomShortcutAction(input: {
  type: string
  key: string
  code: string
  control: boolean
  meta: boolean
  alt: boolean
}) {
  if (input.type !== 'keyDown') {
    return null
  }

  if (!(input.control || input.meta) || input.alt) {
    return null
  }

  if (
    input.code === 'Equal' ||
    input.code === 'NumpadAdd' ||
    input.key === '+' ||
    input.key === '='
  ) {
    return 'zoom-in'
  }

  if (
    input.code === 'Minus' ||
    input.code === 'NumpadSubtract' ||
    input.key === '-' ||
    input.key === '_'
  ) {
    return 'zoom-out'
  }

  if (
    input.code === 'Digit0' ||
    input.code === 'Numpad0' ||
    input.key === '0' ||
    input.key === ')'
  ) {
    return 'reset'
  }

  return null
}

async function handleWindowZoomShortcut(action: 'zoom-in' | 'zoom-out' | 'reset') {
  const config = await readAppConfig()
  const nextZoomFactor =
    action === 'zoom-in'
      ? getNextWindowZoomFactor(config.ui.zoomFactor, 1)
      : action === 'zoom-out'
        ? getNextWindowZoomFactor(config.ui.zoomFactor, -1)
        : DEFAULT_WINDOW_ZOOM_FACTOR
  const nextConfig = await persistWindowZoomFactor({
    zoomFactor: nextZoomFactor,
  })

  applyWindowZoomFactor(nextConfig.ui.zoomFactor)
  notifyWindowZoomChanged(nextConfig.ui.zoomFactor)
}

export async function updateWindowZoomFactor(zoomFactor: number) {
  const nextConfig = await persistWindowZoomFactor({
    zoomFactor,
  })

  applyWindowZoomFactor(nextConfig.ui.zoomFactor)
  notifyWindowZoomChanged(nextConfig.ui.zoomFactor)
  return nextConfig
}

export async function createMainWindow() {
  Menu.setApplicationMenu(null)

  isWindowDirty = false
  isForceClosingWindow = false
  const initialConfig = await readAppConfig()
  const initialZoomFactor = initialConfig.ui.zoomFactor

  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1080,
    minHeight: 720,
    icon: APP_ICON_PATH,
    title: 'dAiry',
    backgroundColor: '#f7f7f4',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
      zoomFactor: initialZoomFactor,
      spellcheck: false,
    },
  })

  applyWindowZoomFactor(initialZoomFactor)

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.webContents.on('before-input-event', (event, input) => {
    const action = getZoomShortcutAction(input)

    if (!action) {
      return
    }

    event.preventDefault()
    void handleWindowZoomShortcut(action)
  })

  win.on('close', async (event) => {
    if (isForceClosingWindow || !isWindowDirty || !win) {
      return
    }

    event.preventDefault()

    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['仍然关闭', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '还有未保存内容',
      message: '当前内容还没有保存。',
      detail: '如果现在关闭窗口，未保存的修改将会丢失。',
      noLink: true,
    })

    if (response !== 0) {
      return
    }

    isForceClosingWindow = true
    win.close()
  })

  win.on('closed', () => {
    isWindowDirty = false
    isForceClosingWindow = false
    win = null
  })
}

export function registerWindowLifecycleEvents() {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
      win = null
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })
}
