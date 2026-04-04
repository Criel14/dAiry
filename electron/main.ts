import { app, BrowserWindow, Menu, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type {
  AppBootstrap,
  AppConfig,
  JournalEntryQuery,
  JournalEntryReadResult,
  JournalEntryWriteResult,
  WorkspaceSelectionResult,
} from '../src/types/dairy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

const APP_ICON_NAME = process.platform === 'win32' ? 'app.ico' : 'app.png'
const APP_ICON_PATH = path.join(process.env.APP_ROOT, 'build', 'icons', APP_ICON_NAME)

const IPC_CHANNELS = {
  getBootstrap: 'app:get-bootstrap',
  chooseWorkspace: 'workspace:choose',
  readJournalEntry: 'journal:read-entry',
  createJournalEntry: 'journal:create-entry',
  saveJournalEntry: 'journal:save-entry',
} as const

const DEFAULT_APP_CONFIG: AppConfig = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: 'system',
  },
}

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function normalizeAppConfig(rawValue: unknown): AppConfig {
  if (!rawValue || typeof rawValue !== 'object') {
    return DEFAULT_APP_CONFIG
  }

  const config = rawValue as Partial<AppConfig>
  const recentWorkspaces = Array.isArray(config.recentWorkspaces)
    ? config.recentWorkspaces.filter((item): item is string => typeof item === 'string')
    : []
  const theme =
    config.ui?.theme === 'light' || config.ui?.theme === 'dark' || config.ui?.theme === 'system'
      ? config.ui.theme
      : 'system'

  return {
    lastOpenedWorkspace:
      typeof config.lastOpenedWorkspace === 'string' ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
    },
  }
}

async function readAppConfig(): Promise<AppConfig> {
  try {
    const fileContent = await readFile(getConfigFilePath(), 'utf-8')
    return normalizeAppConfig(JSON.parse(fileContent))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_APP_CONFIG
    }

    throw error
  }
}

async function writeAppConfig(config: AppConfig) {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf-8')
}

function buildWorkspaceConfig(workspacePath: string, currentConfig: AppConfig) {
  // 最近目录列表把最新项顶到最前面，同时做去重和数量截断，
  // 这样后面真的做“最近打开”列表时可以直接复用。
  const nextRecentWorkspaces = [
    workspacePath,
    ...currentConfig.recentWorkspaces.filter((item) => item !== workspacePath),
  ]

  return {
    ...currentConfig,
    lastOpenedWorkspace: workspacePath,
    recentWorkspaces: nextRecentWorkspaces.slice(0, 8),
  }
}

function assertValidDate(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('日期格式无效，必须为 YYYY-MM-DD。')
  }
}

function resolveJournalEntryPath({ workspacePath, date }: JournalEntryQuery) {
  assertValidDate(date)

  const [year, month] = date.split('-')
  // 当前版本按用户最新要求固定为 workspace/journal/YYYY/MM/YYYY-MM-DD.md。
  return path.join(workspacePath, 'journal', year, month, `${date}.md`)
}

async function readJournalEntry(input: JournalEntryQuery): Promise<JournalEntryReadResult> {
  const filePath = resolveJournalEntryPath(input)

  try {
    const content = await readFile(filePath, 'utf-8')
    return {
      status: 'ready',
      filePath,
      content,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        status: 'missing',
        filePath,
        content: null,
      }
    }

    throw error
  }
}

async function createJournalEntry(input: JournalEntryQuery): Promise<JournalEntryReadResult> {
  const filePath = resolveJournalEntryPath(input)
  await mkdir(path.dirname(filePath), { recursive: true })

  try {
    // wx 保证“仅当文件不存在时创建”，避免误覆盖已有内容。
    await writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }

  return readJournalEntry(input)
}

async function saveJournalEntry(
  input: JournalEntryQuery & { content: string },
): Promise<JournalEntryWriteResult> {
  const filePath = resolveJournalEntryPath(input)

  // 保存前保证年月目录存在，这样首次写入时不需要额外准备目录结构。
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, input.content, 'utf-8')

  return {
    filePath,
    savedAt: new Date().toISOString(),
  }
}

function registerIpcHandlers() {
  // 主进程把“配置、目录选择、文件读写”集中在这里统一注册，
  // 渲染层只关心调用结果，不直接接触 Node 文件系统能力。
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async (): Promise<AppBootstrap> => {
    const config = await readAppConfig()
    return { config }
  })

  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async (): Promise<WorkspaceSelectionResult> => {
    const currentConfig = await readAppConfig()
    const dialogOptions: OpenDialogOptions = {
      title: '选择日记目录',
      buttonLabel: '选择这个目录',
      properties: ['openDirectory'],
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
        workspacePath: null,
        config: currentConfig,
      }
    }

    const workspacePath = result.filePaths[0]
    const nextConfig = buildWorkspaceConfig(workspacePath, currentConfig)
    await writeAppConfig(nextConfig)

    return {
      canceled: false,
      workspacePath,
      config: nextConfig,
    }
  })

  ipcMain.handle(IPC_CHANNELS.readJournalEntry, (_event, input: JournalEntryQuery) => {
    return readJournalEntry(input)
  })

  ipcMain.handle(IPC_CHANNELS.createJournalEntry, (_event, input: JournalEntryQuery) => {
    return createJournalEntry(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.saveJournalEntry,
    (_event, input: JournalEntryQuery & { content: string }) => {
      return saveJournalEntry(input)
    },
  )
}

function createWindow() {
  Menu.setApplicationMenu(null)

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    icon: APP_ICON_PATH,
    title: 'dAiry',
    backgroundColor: '#f7f7f4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
