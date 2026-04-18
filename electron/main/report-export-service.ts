import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { BrowserWindow, app, dialog, type SaveDialogOptions } from 'electron'
import dayjs from 'dayjs'
import type {
  ExportRangeReportInput,
  ExportRangeReportResult,
  ReportExportPayload,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
  ReportExportSectionKey,
  RangeReport,
} from '../../src/types/dairy'
import { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL } from './constants'
import { readAppConfig, setLastReportExportDirectory } from './app-config'
import { getRangeReport } from './report-service'
import { getMainWindow } from './window'

interface ExportSessionState {
  payload: ReportExportPayload
  readyPromise: Promise<number>
  resolveReady: (contentHeight: number) => void
  isReady: boolean
}

const EXPORT_DEFAULT_DOCUMENT_WIDTH = 1200
const EXPORT_MIN_DOCUMENT_WIDTH = 600
const EXPORT_MAX_DOCUMENT_WIDTH = 2400
const EXPORT_INITIAL_HEIGHT = 900
const EXPORT_MIN_HEIGHT = 420
const EXPORT_MAX_HEIGHT = 12000
const EXPORT_READY_TIMEOUT_MS = 20_000
const EXPORT_DEFAULT_IMAGE_SCALE = 1.5
const EXPORT_MIN_IMAGE_SCALE = 1
const EXPORT_MAX_IMAGE_SCALE = 3

const EXPORT_SECTION_ORDER: ReportExportSectionKey[] = [
  'cover',
  'stats',
  'summary',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'locationPatterns',
  'timePatterns',
]

const exportSessions = new Map<string, ExportSessionState>()

function sanitizeExportFileName(name: string) {
  const sanitized = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || '报告导出'
}

function buildDefaultExportFileName(report: RangeReport) {
  const startDate = dayjs(report.period.startDate)

  if (report.preset === 'month') {
    const label = startDate.isValid()
      ? `${startDate.year()}年${startDate.month() + 1}月总结`
      : report.period.label
    return sanitizeExportFileName(label)
  }

  if (report.preset === 'year') {
    const label = startDate.isValid()
      ? `${startDate.year()}年总结`
      : report.period.label
    return sanitizeExportFileName(label)
  }

  const customLabel = `${report.period.startDate}至${report.period.endDate}总结`
  return sanitizeExportFileName(customLabel)
}

function ensurePngExtension(filePath: string) {
  if (path.extname(filePath).toLowerCase() === '.png') {
    return filePath
  }

  return `${filePath}.png`
}

function getReportAvailableExportSections(report: RangeReport) {
  const availableSections = new Set<ReportExportSectionKey>(['cover', 'stats', 'summary'])

  if (report.sections.heatmap) {
    availableSections.add('heatmap')
  }

  if (report.sections.moodTrend) {
    availableSections.add('moodTrend')
  }

  if (report.sections.tagCloud) {
    availableSections.add('tagCloud')
  }

  if (report.sections.locationPatterns) {
    availableSections.add('locationPatterns')
  }

  if (report.sections.timePatterns) {
    availableSections.add('timePatterns')
  }

  return availableSections
}

function normalizeExportSections(
  requestedSections: ReportExportSectionKey[],
  report: RangeReport,
) {
  const availableSections = getReportAvailableExportSections(report)
  const uniqueSections = new Set<ReportExportSectionKey>()

  for (const section of requestedSections) {
    if (EXPORT_SECTION_ORDER.includes(section) && availableSections.has(section)) {
      uniqueSections.add(section)
    }
  }

  return EXPORT_SECTION_ORDER.filter((section) => uniqueSections.has(section))
}

function normalizeExportImageScale(imageScale: number | undefined) {
  if (!Number.isFinite(imageScale)) {
    return EXPORT_DEFAULT_IMAGE_SCALE
  }

  const normalizedScale = Math.round((imageScale ?? EXPORT_DEFAULT_IMAGE_SCALE) * 10) / 10

  return Math.min(
    EXPORT_MAX_IMAGE_SCALE,
    Math.max(EXPORT_MIN_IMAGE_SCALE, normalizedScale),
  )
}

function normalizeExportDocumentWidth(documentWidth: number | undefined) {
  if (!Number.isFinite(documentWidth)) {
    return EXPORT_DEFAULT_DOCUMENT_WIDTH
  }

  const normalizedWidth = Math.round(documentWidth ?? EXPORT_DEFAULT_DOCUMENT_WIDTH)

  return Math.min(
    EXPORT_MAX_DOCUMENT_WIDTH,
    Math.max(EXPORT_MIN_DOCUMENT_WIDTH, normalizedWidth),
  )
}

function createExportSession(payload: ReportExportPayload) {
  const sessionId = `report_export_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  let resolveReady: (contentHeight: number) => void = () => {}
  const readyPromise = new Promise<number>((resolve) => {
    resolveReady = resolve
  })

  exportSessions.set(sessionId, {
    payload,
    readyPromise,
    resolveReady,
    isReady: false,
  })

  return sessionId
}

function removeExportSession(sessionId: string) {
  exportSessions.delete(sessionId)
}

async function createExportWindow(sessionId: string) {
  const session = exportSessions.get(sessionId)

  if (!session) {
    throw new Error('导出会话不存在，请重新尝试导出。')
  }

  const exportWindow = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: session.payload.documentWidth,
    height: EXPORT_INITIAL_HEIGHT,
    backgroundColor: '#f6f2e8',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    const devUrl = new URL(VITE_DEV_SERVER_URL)
    devUrl.searchParams.set('mode', 'report-export')
    devUrl.searchParams.set('sessionId', sessionId)
    await exportWindow.loadURL(devUrl.toString())
  } else {
    await exportWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: {
        mode: 'report-export',
        sessionId,
      },
    })
  }

  return exportWindow
}

function getScaledCaptureSize(width: number, height: number, imageScale: number) {
  return {
    width: Math.max(1, Math.ceil(width * imageScale)),
    height: Math.max(1, Math.ceil(height * imageScale)),
  }
}

async function waitForExportReady(sessionId: string) {
  const session = exportSessions.get(sessionId)
  if (!session) {
    throw new Error('导出会话不存在，请重新尝试导出。')
  }

  const timeoutPromise = new Promise<number>((_, reject) => {
    setTimeout(() => {
      reject(new Error('导出页面准备超时，请稍后重试。'))
    }, EXPORT_READY_TIMEOUT_MS)
  })

  return Promise.race([session.readyPromise, timeoutPromise])
}

function normalizeExportHeight(contentHeight: number) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    throw new Error('导出内容高度无效，请稍后重试。')
  }

  const height = Math.ceil(contentHeight)

  if (height > EXPORT_MAX_HEIGHT) {
    throw new Error(`导出内容过长（${height}px），超过单张长图上限（${EXPORT_MAX_HEIGHT}px）。`)
  }

  return Math.max(height, EXPORT_MIN_HEIGHT)
}

async function buildSaveDialogDefaultPath(fileName: string) {
  const config = await readAppConfig()
  const baseDirectory = config.reportExport.lastDirectory || app.getPath('downloads')
  return path.join(baseDirectory, `${fileName}.png`)
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 120)
  })
}

export async function exportRangeReportPng(
  input: ExportRangeReportInput,
): Promise<ExportRangeReportResult> {
  const workspacePath = input.workspacePath.trim()
  const reportId = input.reportId.trim()
  const documentWidth = normalizeExportDocumentWidth(input.documentWidth)
  const imageScale = normalizeExportImageScale(input.imageScale)

  if (!workspacePath) {
    throw new Error('当前没有可用工作区，无法导出报告。')
  }

  if (!reportId) {
    throw new Error('报告标识无效，无法导出。')
  }

  const report = await getRangeReport({
    workspacePath,
    reportId,
  })
  const normalizedSections = normalizeExportSections(input.sections, report)

  if (normalizedSections.length === 0) {
    throw new Error('导出内容为空，请至少选择一个可导出的模块。')
  }

  const defaultFileName = buildDefaultExportFileName(report)
  const saveDialogOptions: SaveDialogOptions = {
    title: '导出报告 PNG',
    buttonLabel: '保存图片',
    defaultPath: await buildSaveDialogDefaultPath(defaultFileName),
    filters: [
      { name: 'PNG 图片', extensions: ['png'] },
    ],
  }
  const ownerWindow = getMainWindow()
  const saveResult = ownerWindow
    ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
    : await dialog.showSaveDialog(saveDialogOptions)

  if (saveResult.canceled || !saveResult.filePath) {
    return {
      canceled: true,
      filePaths: [],
      exportedSections: normalizedSections,
      imageCount: 0,
    }
  }

  const filePath = ensurePngExtension(saveResult.filePath)

  try {
    await setLastReportExportDirectory(path.dirname(filePath))
  } catch (error) {
    console.warn('保存报告导出目录失败，下次将继续使用默认目录。', error)
  }

  const sessionId = createExportSession({
    report,
    sections: normalizedSections,
    documentWidth,
    imageScale,
  })

  let exportWindow: BrowserWindow | null = null

  try {
    exportWindow = await createExportWindow(sessionId)
    const contentHeight = await waitForExportReady(sessionId)
    const captureHeight = normalizeExportHeight(contentHeight)
    const scaledCaptureSize = getScaledCaptureSize(
      documentWidth,
      captureHeight,
      imageScale,
    )

    exportWindow.setContentSize(scaledCaptureSize.width, scaledCaptureSize.height)
    await waitForNextFrame()
    await waitForNextFrame()

    const image = await exportWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width: scaledCaptureSize.width,
      height: scaledCaptureSize.height,
    })

    if (image.isEmpty()) {
      throw new Error('导出失败，截图结果为空。')
    }

    await writeFile(filePath, image.toPNG())

    return {
      canceled: false,
      filePaths: [filePath],
      exportedSections: normalizedSections,
      imageCount: 1,
    }
  } finally {
    removeExportSession(sessionId)

    if (exportWindow && !exportWindow.isDestroyed()) {
      exportWindow.destroy()
    }
  }
}

export async function getReportExportPayload(input: ReportExportPayloadQuery) {
  const sessionId = input.sessionId.trim()
  const session = exportSessions.get(sessionId)

  if (!session) {
    throw new Error('导出会话已失效，请重新开始导出。')
  }

  return session.payload
}

export async function notifyReportExportReady(input: ReportExportReadyInput) {
  const sessionId = input.sessionId.trim()
  const session = exportSessions.get(sessionId)

  if (!session) {
    throw new Error('导出会话已失效，请重新开始导出。')
  }

  if (session.isReady) {
    return
  }

  session.isReady = true
  session.resolveReady(input.contentHeight)
}
