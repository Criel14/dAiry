import type { ReportExportSectionKey } from '../../../src/types/report'

export const EXPORT_DEFAULT_DOCUMENT_WIDTH = 1200
export const EXPORT_MIN_DOCUMENT_WIDTH = 600
export const EXPORT_MAX_DOCUMENT_WIDTH = 2400
export const EXPORT_INITIAL_HEIGHT = 900
export const EXPORT_MIN_HEIGHT = 420
export const EXPORT_MAX_HEIGHT = 12000
export const EXPORT_READY_TIMEOUT_MS = 20_000
export const EXPORT_DEFAULT_IMAGE_SCALE = 1.5
export const EXPORT_MIN_IMAGE_SCALE = 1
export const EXPORT_MAX_IMAGE_SCALE = 3

export const EXPORT_SECTION_ORDER: ReportExportSectionKey[] = [
  'cover',
  'stats',
  'summary',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'locationPatterns',
  'timePatterns',
]
