import type { RangeReport, ReportExportSectionKey } from '../types/report'

/** 导出文档固定 section 顺序（展示与导出两侧共用，避免双端人工维护漂移） */
export const REPORT_EXPORT_SECTION_ORDER: ReportExportSectionKey[] = [
  'cover',
  'stats',
  'summary',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'locationPatterns',
  'timePatterns',
]

export const REPORT_EXPORT_DEFAULT_DOCUMENT_WIDTH = 1200
export const REPORT_EXPORT_MIN_DOCUMENT_WIDTH = 1000
export const REPORT_EXPORT_MAX_DOCUMENT_WIDTH = 2400
export const REPORT_EXPORT_INITIAL_HEIGHT = 900
export const REPORT_EXPORT_MIN_HEIGHT = 420
export const REPORT_EXPORT_MAX_HEIGHT = 12000
export const REPORT_EXPORT_READY_TIMEOUT_MS = 20_000
export const REPORT_EXPORT_DEFAULT_IMAGE_SCALE = 1.5
export const REPORT_EXPORT_MIN_IMAGE_SCALE = 1
export const REPORT_EXPORT_MAX_IMAGE_SCALE = 3

export const REPORT_EXPORT_SECTION_OPTIONS: Array<{
  key: ReportExportSectionKey
  label: string
  description: string
}> = [
  { key: 'cover', label: '标题封面', description: '标题、区间和预设类型' },
  { key: 'stats', label: '基础统计', description: '记录天数、字数、连续记录等' },
  { key: 'summary', label: '区间概览', description: '总结文本与推进/阻塞/记忆点' },
  { key: 'heatmap', label: '字数热力图', description: '按日期查看写作字数分布' },
  { key: 'moodTrend', label: '情绪变化', description: '查看区间内心情曲线' },
  { key: 'tagCloud', label: '标签词云', description: '高频标签与关注主题' },
  { key: 'locationPatterns', label: '地点分析', description: '常见地点与地点排行' },
  { key: 'timePatterns', label: '时间段分析', description: '写作时间段分布' },
]

const ALWAYS_AVAILABLE_EXPORT_SECTIONS: ReportExportSectionKey[] = ['cover', 'stats', 'summary']

/** 根据报告实际存在的 section 计算可导出的模块（主进程与渲染端共用） */
export function getReportAvailableExportSections(report: RangeReport | null) {
  const availableSections = new Set<ReportExportSectionKey>(ALWAYS_AVAILABLE_EXPORT_SECTIONS)

  if (!report) {
    return availableSections
  }

  for (const key of [
    'heatmap',
    'moodTrend',
    'tagCloud',
    'locationPatterns',
    'timePatterns',
  ] as const) {
    if (report.sections[key]) {
      availableSections.add(key)
    }
  }

  return availableSections
}

/** 渲染端导出对话框默认勾选的 section：按固定顺序取全部可用项 */
export function getDefaultExportSections(report: RangeReport | null) {
  const availableSections = getReportAvailableExportSections(report)

  return REPORT_EXPORT_SECTION_ORDER.filter((sectionKey) => availableSections.has(sectionKey))
}
