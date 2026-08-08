import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog, nativeImage, screen, type SaveDialogOptions } from 'electron'
import type {
  ExportRangeReportInput,
  ExportRangeReportResult,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
} from '../../../src/types/report'
import { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL } from '../constants'
import { setLastReportExportDirectory } from '../app-config'
import { getRangeReport } from '../report'
import { getMainWindow } from '../window'
import {
  EXPORT_INITIAL_HEIGHT,
  EXPORT_READY_TIMEOUT_MS,
} from './constants'
import {
  createExportSession,
  getExportSession,
  markExportSessionError,
  markExportSessionReady,
  removeExportSession,
} from './session-store'
import {
  buildDefaultExportFileName,
  buildSaveDialogDefaultPath,
  ensurePngExtension,
  getExportCaptureZoom,
  normalizeExportDocumentWidth,
  normalizeExportHeight,
  normalizeExportImageScale,
  normalizeExportSections,
  waitForNextFrame,
} from './utils'

/**
 * 分条截图时窗口内容高度上限（DIP）：超过后滚动分条截图再拼图，
 * 避免超大窗口触碰系统/合成器尺寸上限导致底部被钳制裁切。
 */
const EXPORT_STRIP_MAX_HEIGHT = 7000

async function createExportWindow(sessionId: string, windowWidth: number) {
  const session = getExportSession(sessionId)

  if (!session) {
    throw new Error('导出会话不存在，请重新尝试导出。')
  }

  const exportWindow = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: windowWidth,
    height: EXPORT_INITIAL_HEIGHT,
    backgroundColor: '#f6f2e8',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
      backgroundThrottling: false,
      // 独立内存 partition：setZoomFactor 的 zoom level 按 origin 持久化，
      // 若与主窗口共用 session 会污染主窗口 UI 缩放（导出后不还原），
      // 用非持久 partition 彻底隔离
      partition: 'report-export',
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

/**
 * 分条截图：窗口保持安全高度，把内容高度按条数等分滚动截图后按行拼图，
 * 最后统一 resize 到精确目标尺寸（宽/高 × imageScale）。
 * 条高按内容高度均分而非固定值，避免最后一条滚动被钳制产生重叠区域。
 */
async function captureReportImage(
  exportWindow: BrowserWindow,
  targetWidth: number,
  targetHeight: number,
  windowDipWidth: number,
  captureHeight: number,
  zoomFactor: number,
) {
  const windowDipHeight = Math.max(1, Math.round(captureHeight * zoomFactor))
  const useStrips = windowDipHeight > EXPORT_STRIP_MAX_HEIGHT
  const stripCount = useStrips ? Math.ceil(windowDipHeight / EXPORT_STRIP_MAX_HEIGHT) : 1
  const windowHeight = useStrips
    ? Math.max(1, Math.round((captureHeight / stripCount) * zoomFactor))
    : windowDipHeight
  const cssStripHeight = captureHeight / stripCount

  exportWindow.setContentSize(windowDipWidth, windowHeight)

  const stripBuffers: Buffer[] = []
  let stripPixelWidth = 0
  let totalPixelHeight = 0

  for (let index = 0; index < stripCount; index += 1) {
    if (index > 0) {
      await exportWindow.webContents.executeJavaScript(
        `window.scrollTo(0, ${Math.round(index * cssStripHeight)})`,
      )
      await waitForNextFrame()
    }

    await waitForNextFrame()

    const image = await exportWindow.webContents.capturePage()

    if (image.isEmpty()) {
      throw new Error('导出失败，截图结果为空。')
    }

    const imageSize = image.getSize()

    if (index === 0) {
      stripPixelWidth = imageSize.width
    }

    totalPixelHeight += imageSize.height
    stripBuffers.push(image.toBitmap())
  }

  const stitchedImage = nativeImage.createFromBitmap(Buffer.concat(stripBuffers), {
    width: stripPixelWidth,
    height: totalPixelHeight,
  })

  return stitchedImage.resize({
    width: Math.max(1, targetWidth),
    height: Math.max(1, targetHeight),
    quality: 'best',
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
    const deviceScaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
    const zoomFactor = getExportCaptureZoom(imageScale, deviceScaleFactor)
    const targetWidth = Math.max(1, Math.ceil(documentWidth * imageScale))
    const windowDipWidth = Math.max(1, Math.round(documentWidth * zoomFactor))

    exportWindow = await createExportWindow(sessionId, windowDipWidth)
    exportWindow.webContents.setZoomFactor(zoomFactor)

    const contentHeight = await waitForExportReady(sessionId)
    const captureHeight = normalizeExportHeight(contentHeight)
    const targetHeight = Math.max(1, Math.ceil(captureHeight * imageScale))

    const finalImage = await captureReportImage(
      exportWindow,
      targetWidth,
      targetHeight,
      windowDipWidth,
      captureHeight,
      zoomFactor,
    )
    const finalSize = finalImage.getSize()

    if (finalSize.width !== targetWidth || finalSize.height !== targetHeight) {
      console.warn(
        `导出截图尺寸与预期不符：期望 ${targetWidth}x${targetHeight}，` +
          `实际 ${finalSize.width}x${finalSize.height}。`,
      )
    }

    await writeFile(filePath, finalImage.toPNG())

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

export async function notifyReportExportError(input: { sessionId: string; message: string }) {
  markExportSessionError(input.sessionId.trim(), input.message.trim() || '导出页面初始化失败。')
}
