import path from 'node:path'
import dayjs from 'dayjs'
import { app } from 'electron'
import type { RangeReport, ReportExportSectionKey } from '../../../src/types/report'
import { readAppConfig } from '../app-config'
import {
  EXPORT_DEFAULT_DOCUMENT_WIDTH,
  EXPORT_DEFAULT_IMAGE_SCALE,
  EXPORT_MAX_DOCUMENT_WIDTH,
  EXPORT_MAX_HEIGHT,
  EXPORT_MAX_IMAGE_SCALE,
  EXPORT_MIN_DOCUMENT_WIDTH,
  EXPORT_MIN_HEIGHT,
  EXPORT_MIN_IMAGE_SCALE,
  EXPORT_SECTION_ORDER,
} from './constants'

function sanitizeExportFileName(name: string) {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()

  return sanitized || '报告导出'
}

export function buildDefaultExportFileName(report: RangeReport) {
  const startDate = dayjs(report.period.startDate)

  if (report.preset === 'month') {
    const label = startDate.isValid()
      ? `${startDate.year()}年${startDate.month() + 1}月总结`
      : report.period.label
    return sanitizeExportFileName(label)
  }

  if (report.preset === 'year') {
    const label = startDate.isValid() ? `${startDate.year()}年总结` : report.period.label
    return sanitizeExportFileName(label)
  }

  const customLabel = `${report.period.startDate}至${report.period.endDate}总结`
  return sanitizeExportFileName(customLabel)
}

export function ensurePngExtension(filePath: string) {
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

export function normalizeExportSections(
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

export function normalizeExportImageScale(imageScale: number | undefined) {
  if (!Number.isFinite(imageScale)) {
    return EXPORT_DEFAULT_IMAGE_SCALE
  }

  const normalizedScale = Math.round((imageScale ?? EXPORT_DEFAULT_IMAGE_SCALE) * 10) / 10

  return Math.min(EXPORT_MAX_IMAGE_SCALE, Math.max(EXPORT_MIN_IMAGE_SCALE, normalizedScale))
}

export function normalizeExportDocumentWidth(documentWidth: number | undefined) {
  if (!Number.isFinite(documentWidth)) {
    return EXPORT_DEFAULT_DOCUMENT_WIDTH
  }

  const normalizedWidth = Math.round(documentWidth ?? EXPORT_DEFAULT_DOCUMENT_WIDTH)

  return Math.min(EXPORT_MAX_DOCUMENT_WIDTH, Math.max(EXPORT_MIN_DOCUMENT_WIDTH, normalizedWidth))
}

export function getScaledCaptureSize(width: number, height: number, imageScale: number) {
  return {
    width: Math.max(1, Math.ceil(width * imageScale)),
    height: Math.max(1, Math.ceil(height * imageScale)),
  }
}

export function normalizeExportHeight(contentHeight: number) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    throw new Error('导出内容高度无效，请稍后重试。')
  }

  const height = Math.ceil(contentHeight)

  if (height > EXPORT_MAX_HEIGHT) {
    throw new Error(`导出内容过长（${height}px），超过单张长图上限（${EXPORT_MAX_HEIGHT}px）。`)
  }

  return Math.max(height, EXPORT_MIN_HEIGHT)
}

export async function buildSaveDialogDefaultPath(fileName: string) {
  const config = await readAppConfig()
  const baseDirectory = config.reportExport.lastDirectory || app.getPath('downloads')
  return path.join(baseDirectory, `${fileName}.png`)
}

export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 120)
  })
}
