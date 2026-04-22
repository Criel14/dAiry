import { app, BrowserWindow, Menu, Tray, dialog, nativeTheme } from 'electron'
import path from 'node:path'
import {
  APP_ICON_PATH,
  IPC_CHANNELS,
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL,
} from './constants'
import { readAppConfig, setWindowZoomFactor as persistWindowZoomFactor } from './app-config'
import type { AppTheme, WindowCloseBehavior } from '../../src/types/app'
import type { RightPanel } from '../../src/types/ui'
import {
  DEFAULT_WINDOW_ZOOM_FACTOR,
  getNextWindowZoomFactor,
  normalizeWindowZoomFactor,
} from '../../src/shared/window-zoom'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isWindowDirty = false
let isForceClosingWindow = false
let isQuitRequested = false
let currentWindowCloseBehavior: WindowCloseBehavior = 'tray'

export function applyNativeThemeSource(theme: AppTheme) {
  nativeTheme.themeSource = theme
}

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

function destroyTray() {
  tray?.destroy()
  tray = null
}

function showMainWindow() {
  if (!win || win.isDestroyed()) {
    return
  }

  win.setSkipTaskbar(false)

  if (win.isMinimized()) {
    win.restore()
  }

  win.show()
  win.focus()
}

export function navigateMainPanel(panel: RightPanel) {
  if (!win || win.isDestroyed()) {
    return
  }

  showMainWindow()
  win.webContents.send(IPC_CHANNELS.navigateMainPanel, { panel })
}

export function canSendDiaryReminder() {
  if (!win || win.isDestroyed()) {
    return false
  }

  return true
}

function requestAppQuit() {
  isQuitRequested = true
  app.quit()
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: '写作',
      click: () => {
        navigateMainPanel('journal')
      },
    },
    {
      label: '报告',
      click: () => {
        navigateMainPanel('reports')
      },
    },
    {
      label: '设置',
      click: () => {
        navigateMainPanel('settings')
      },
    },
    {
      label: '退出',
      click: () => {
        requestAppQuit()
      },
    },
  ])
}

function ensureTray() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
    return tray
  }

  tray = new Tray(APP_ICON_PATH)
  tray.setToolTip('dAiry')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    showMainWindow()
  })
  tray.on('double-click', () => {
    showMainWindow()
  })
  return tray
}

function hideMainWindowToTray() {
  if (!win || win.isDestroyed()) {
    return
  }

  ensureTray()
  win.setSkipTaskbar(true)
  win.hide()
}

export function applyWindowCloseBehavior(closeBehavior: WindowCloseBehavior) {
  currentWindowCloseBehavior = closeBehavior

  if (closeBehavior === 'quit') {
    destroyTray()
  }
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

  applyNativeThemeSource(initialConfig.ui.theme)
  applyWindowCloseBehavior(initialConfig.ui.closeBehavior)

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
    if (isForceClosingWindow || !win) {
      return
    }

    if (currentWindowCloseBehavior === 'tray' && !isQuitRequested) {
      event.preventDefault()
      hideMainWindowToTray()
      return
    }

    if (!isWindowDirty) {
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
      isQuitRequested = false
      return
    }

    isForceClosingWindow = true
    win.close()
  })

  win.on('closed', () => {
    isWindowDirty = false
    isForceClosingWindow = false
    isQuitRequested = false
    win = null
  })
}

export function registerWindowLifecycleEvents() {
  app.on('before-quit', () => {
    isQuitRequested = true
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      destroyTray()
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
