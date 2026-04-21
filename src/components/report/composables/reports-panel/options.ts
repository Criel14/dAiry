import type { ReportSectionKey } from '../../../../types/report'

export const REPORT_SECTION_OPTIONS: Array<{
  key: ReportSectionKey
  label: string
  description: string
}> = [
  { key: 'stats', label: '基础统计', description: '记录天数、总字数、连续记录等' },
  { key: 'heatmap', label: '字数热力图', description: '按日期查看区间内写作分布' },
  { key: 'moodTrend', label: '情绪变化', description: '按日期查看心情分布与均值' },
  { key: 'tagCloud', label: '标签词云', description: '汇总高频标签，便于看主题集中度' },
  { key: 'locationPatterns', label: '地点分析', description: '汇总区间内最常写作和最独特的地点' },
  { key: 'timePatterns', label: '时间段分析', description: '查看写作主要集中在一天中的哪个时间段' },
]

export const REQUIRED_REPORT_SECTION: ReportSectionKey = 'stats'

export function normalizeSelectedSections(sections: ReportSectionKey[]) {
  const uniqueSections = Array.from(new Set(sections))

  if (uniqueSections.includes(REQUIRED_REPORT_SECTION)) {
    return uniqueSections
  }

  return [REQUIRED_REPORT_SECTION, ...uniqueSections]
}
