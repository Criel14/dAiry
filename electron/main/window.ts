import { app, BrowserWindow, Menu, dialog } from 'electron'
import path from 'node:path'
import { APP_ICON_PATH, MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL } from './constants'

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

export function createMainWindow() {
  Menu.setApplicationMenu(null)

  isWindowDirty = false
  isForceClosingWindow = false

  win = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1080,
    minHeight: 720,
    icon: APP_ICON_PATH,
    title: 'dAiry',
    backgroundColor: '#f7f7f4',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

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
      createMainWindow()
    }
  })
}
