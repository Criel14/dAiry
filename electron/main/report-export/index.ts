import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog, type SaveDialogOptions } from 'electron'
import type {
  ExportRangeReportInput,
  ExportRangeReportResult,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
} from '../../../src/types/report'
import { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL } from '../constants'
import { setLastReportExportDirectory } from '../app-config'
import { getRangeReport } from '../report-service'
import { getMainWindow } from '../window'
import {
  EXPORT_INITIAL_HEIGHT,
  EXPORT_READY_TIMEOUT_MS,
} from './constants'
import {
  createExportSession,
  getExportSession,
  markExportSessionReady,
  removeExportSession,
} from './session-store'
import {
  buildDefaultExportFileName,
  buildSaveDialogDefaultPath,
  ensurePngExtension,
  getScaledCaptureSize,
  normalizeExportDocumentWidth,
  normalizeExportHeight,
  normalizeExportImageScale,
  normalizeExportSections,
  waitForNextFrame,
} from './utils'

async function createExportWindow(sessionId: string) {
  const session = getExportSession(sessionId)

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

async function waitForExportReady(sessionId: string) {
  const session = getExportSession(sessionId)
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
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
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
    const scaledCaptureSize = getScaledCaptureSize(documentWidth, captureHeight, imageScale)

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
  const session = getExportSession(sessionId)

  if (!session) {
    throw new Error('导出会话已失效，请重新开始导出。')
  }

  return session.payload
}

export async function notifyReportExportReady(input: ReportExportReadyInput) {
  markExportSessionReady(input.sessionId.trim(), input.contentHeight)
}
