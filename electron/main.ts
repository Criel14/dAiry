import { app, BrowserWindow, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 约定应用根目录，供开发环境和打包后的路径解析复用。
process.env.APP_ROOT = path.join(__dirname, '..')
const APP_ICON_NAME = process.platform === 'win32' ? 'app.ico' : 'app.png'
const APP_ICON_PATH = path.join(process.env.APP_ROOT, 'build', 'icons', APP_ICON_NAME)

// 开发环境下由 Vite 提供本地调试地址，生产环境下为空。
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// 开发环境读取 public 目录，生产环境读取构建后的前端资源目录。
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  // 禁用 Electron 默认应用菜单。
  Menu.setApplicationMenu(null)

  win = new BrowserWindow({
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // 页面加载完成后，向渲染进程发送一条测试消息。
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Windows 和 Linux 在所有窗口关闭后直接退出，macOS 保留应用实例。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // macOS 下点击 Dock 图标且没有窗口时，重新创建主窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
