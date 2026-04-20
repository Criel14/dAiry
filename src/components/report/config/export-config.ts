import type { RangeReport, ReportExportSectionKey } from '../../../types/report'

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

const ALWAYS_AVAILABLE_SECTIONS: ReportExportSectionKey[] = ['cover', 'stats', 'summary']

export function getAvailableExportSections(report: RangeReport | null) {
  const availableSections = new Set<ReportExportSectionKey>(ALWAYS_AVAILABLE_SECTIONS)

  if (!report) {
    return availableSections
  }

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

export function getDefaultExportSections(report: RangeReport | null) {
  const availableSections = getAvailableExportSections(report)

  return REPORT_EXPORT_SECTION_OPTIONS
    .map((option) => option.key)
    .filter((sectionKey) => availableSections.has(sectionKey))
}
