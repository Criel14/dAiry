import { app, BrowserWindow, Menu, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type {
  AppBootstrap,
  AppConfig,
  JournalDayActivity,
  JournalEntryQuery,
  JournalEntryReadResult,
  JournalHeatmapPreferenceInput,
  JournalMonthActivityQuery,
  JournalMonthActivityResult,
  JournalEntryWriteResult,
  WindowDirtyStateInput,
  WorkspaceSelectionResult,
} from '../src/types/dairy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

const APP_ICON_NAME = process.platform === 'win32' ? 'app.ico' : 'app.png'
const APP_ICON_PATH = path.join(process.env.APP_ROOT, 'build', 'icons', APP_ICON_NAME)

const IPC_CHANNELS = {
  getBootstrap: 'app:get-bootstrap',
  setJournalHeatmapEnabled: 'app:set-journal-heatmap-enabled',
  setWindowDirtyState: 'app:set-window-dirty-state',
  chooseWorkspace: 'workspace:choose',
  readJournalEntry: 'journal:read-entry',
  createJournalEntry: 'journal:create-entry',
  saveJournalEntry: 'journal:save-entry',
  getJournalMonthActivity: 'journal:get-month-activity',
} as const

const DEFAULT_APP_CONFIG: AppConfig = {
  lastOpenedWorkspace: null,
  recentWorkspaces: [],
  ui: {
    theme: 'system',
    journalHeatmapEnabled: false,
  },
}

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let isWindowDirty = false
let isForceClosingWindow = false

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
  const journalHeatmapEnabled = config.ui?.journalHeatmapEnabled === true

  return {
    lastOpenedWorkspace:
      typeof config.lastOpenedWorkspace === 'string' ? config.lastOpenedWorkspace : null,
    recentWorkspaces,
    ui: {
      theme,
      journalHeatmapEnabled,
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

async function setJournalHeatmapEnabled(
  input: JournalHeatmapPreferenceInput,
): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const nextConfig: AppConfig = {
    ...currentConfig,
    ui: {
      ...currentConfig.ui,
      journalHeatmapEnabled: input.enabled,
    },
  }

  await writeAppConfig(nextConfig)
  return nextConfig
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

function assertValidMonth(monthText: string) {
  if (!/^\d{4}-\d{2}$/.test(monthText)) {
    throw new Error('月份格式无效，必须为 YYYY-MM。')
  }
}

function resolveJournalEntryFilePath(workspacePath: string, date: string) {
  assertValidDate(date)

  const [year, month] = date.split('-')
  // 当前版本按用户最新要求固定为 workspace/journal/YYYY/MM/YYYY-MM-DD.md。
  return path.join(workspacePath, 'journal', year, month, `${date}.md`)
}

function resolveJournalEntryPath({ workspacePath, date }: JournalEntryQuery) {
  return resolveJournalEntryFilePath(workspacePath, date)
}

function stripFrontmatter(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function countJournalWords(content: string) {
  const bodyContent = stripFrontmatter(content).trim()

  if (!bodyContent) {
    return 0
  }

  // V1 先使用“去除空白后的字符数”作为字数近似，足够稳定也更适合中文日记。
  return bodyContent.replace(/\s+/g, '').length
}

function getDaysInMonth(monthText: string) {
  assertValidMonth(monthText)

  const [yearText, monthValueText] = monthText.split('-')
  const year = Number(yearText)
  const monthValue = Number(monthValueText)

  return new Date(year, monthValue, 0).getDate()
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

async function getJournalMonthActivity(
  input: JournalMonthActivityQuery,
): Promise<JournalMonthActivityResult> {
  const { workspacePath, month } = input
  const totalDays = getDaysInMonth(month)
  const [year, monthValue] = month.split('-')

  const days = await Promise.all(
    Array.from({ length: totalDays }, async (_value, index): Promise<JournalDayActivity> => {
      const day = String(index + 1).padStart(2, '0')
      const date = `${year}-${monthValue}-${day}`
      const filePath = resolveJournalEntryFilePath(workspacePath, date)

      try {
        const content = await readFile(filePath, 'utf-8')
        return {
          date,
          hasEntry: true,
          wordCount: countJournalWords(content),
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            date,
            hasEntry: false,
            wordCount: 0,
          }
        }

        throw error
      }
    }),
  )

  return {
    month,
    days,
  }
}

function registerIpcHandlers() {
  // 主进程把“配置、目录选择、文件读写”集中在这里统一注册，
  // 渲染层只关心调用结果，不直接接触 Node 文件系统能力。
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async (): Promise<AppBootstrap> => {
    const config = await readAppConfig()
    return { config }
  })

  ipcMain.handle(
    IPC_CHANNELS.setJournalHeatmapEnabled,
    (_event, input: JournalHeatmapPreferenceInput) => {
      return setJournalHeatmapEnabled(input)
    },
  )

  ipcMain.handle(IPC_CHANNELS.setWindowDirtyState, (_event, input: WindowDirtyStateInput) => {
    isWindowDirty = input.isDirty
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

  ipcMain.handle(IPC_CHANNELS.getJournalMonthActivity, (_event, input: JournalMonthActivityQuery) => {
    return getJournalMonthActivity(input)
  })
}

function createWindow() {
  Menu.setApplicationMenu(null)

  isWindowDirty = false
  isForceClosingWindow = false

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
