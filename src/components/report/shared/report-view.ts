import dayjs, { type Dayjs } from 'dayjs'
import type {
  RangeReport,
  ReportHeatmapPoint,
  ReportPreset,
  ReportSummaryItem,
  ReportSummaryTimeAnchor,
} from '../../../types/report'

export const REPORT_HEATMAP_WEEKDAY_LABELS = ['周一', '', '周三', '', '周五', '', '']
export const REPORT_HEATMAP_CELL_GAP = 3
export const REPORT_HEATMAP_MIN_CELL_SIZE = 10
export const REPORT_HEATMAP_MAX_CELL_SIZE = 22
export const REPORT_HEATMAP_DEFAULT_CELL_SIZE = 12
export const REPORT_HEATMAP_CUSTOM_CONTEXT_MONTH_COUNT = 13

export interface ReportSummaryGroup {
  key: 'progress' | 'blockers' | 'memorableMoments'
  title: string
  items: ReportSummaryItem[]
}

export interface ReportHeatmapDisplayRange {
  displayStart: Dayjs
  displayEnd: Dayjs
  focusStart: Dayjs
  focusEnd: Dayjs
}

export interface ReportHeatmapCell {
  date: string
  value: number
  level: number
  isInDisplayRange: boolean
  isInFocusRange: boolean
}

export function buildReportSummaryGroups(report: RangeReport | null): ReportSummaryGroup[] {
  if (!report) {
    return []
  }

  const groups: ReportSummaryGroup[] = [
    {
      key: 'progress',
      title: '推进',
      items: report.summary.progress,
    },
    {
      key: 'blockers',
      title: '阻塞',
      items: report.summary.blockers,
    },
    {
      key: 'memorableMoments',
      title: '值得记住',
      items: report.summary.memorableMoments,
    },
  ]

  return groups.filter((group) => group.items.length > 0)
}

export function formatReportPreset(preset: ReportPreset) {
  if (preset === 'month') {
    return '月度'
  }

  if (preset === 'year') {
    return '年度'
  }

  return '自定义'
}

export function getReportHeatLevel(value: number) {
  if (value >= 700) {
    return 4
  }

  if (value >= 400) {
    return 3
  }

  if (value >= 150) {
    return 2
  }

  if (value > 0) {
    return 1
  }

  return 0
}

export function getReportMaxWordsInOneDay(report: RangeReport) {
  if (typeof report.sections.stats?.maxWordsInOneDay === 'number') {
    return report.sections.stats.maxWordsInOneDay
  }

  return report.dailyEntries.reduce((maxValue, entry) => Math.max(maxValue, entry.wordCount), 0)
}

export function buildReportTimeAnchorTitle(timeAnchor: ReportSummaryTimeAnchor) {
  if (timeAnchor.type === 'day') {
    return `对应日期：${timeAnchor.startDate ?? timeAnchor.label}`
  }

  if (timeAnchor.type === 'range') {
    return `对应时间范围：${timeAnchor.startDate ?? timeAnchor.label} 至 ${timeAnchor.endDate ?? timeAnchor.label}`
  }

  if (timeAnchor.type === 'multiple') {
    return `主要对应日期：${timeAnchor.dates?.join('、') ?? timeAnchor.label}`
  }

  if (timeAnchor.startDate && timeAnchor.endDate) {
    return `大致时间范围：${timeAnchor.startDate} 至 ${timeAnchor.endDate}`
  }

  if (timeAnchor.dates?.length) {
    return `综合这些日期：${timeAnchor.dates.join('、')}`
  }

  return `大致对应时间：${timeAnchor.label}`
}

export function getReportSummaryItemKey(groupKey: string, item: ReportSummaryItem) {
  return `${groupKey}-${item.timeAnchor.label}-${item.text}`
}

export function getReportRankingFillWidth(value: number, maxValue: number, minimumPercent = 18) {
  if (maxValue <= 0) {
    return '0%'
  }

  return `${Math.max((value / maxValue) * 100, minimumPercent)}%`
}

export function getReportPatternCount(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as { count?: unknown; countInRange?: unknown }

  if (typeof payload.count === 'number') {
    return payload.count
  }

  if (typeof payload.countInRange === 'number') {
    return payload.countInRange
  }

  return null
}

export function buildReportHeatmapDisplayRange(
  report: RangeReport | null,
  customContextMonthCount = REPORT_HEATMAP_CUSTOM_CONTEXT_MONTH_COUNT,
): ReportHeatmapDisplayRange | null {
  if (!report) {
    return null
  }

  const focusStart = dayjs(report.period.startDate).startOf('day')
  const focusEnd = dayjs(report.period.endDate).startOf('day')

  if (!focusStart.isValid() || !focusEnd.isValid()) {
    return null
  }

  if (report.preset === 'year') {
    return {
      displayStart: focusStart.startOf('year'),
      displayEnd: focusEnd.endOf('year'),
      focusStart,
      focusEnd,
    }
  }

  if (report.preset === 'month' || report.preset === 'custom') {
    const focusMonthStart = focusStart.startOf('month')
    const focusMonthEnd = focusEnd.endOf('month')

    if (report.preset === 'custom') {
      const focusMonthCount = focusMonthEnd.startOf('month').diff(focusMonthStart, 'month') + 1

      if (focusMonthCount >= customContextMonthCount) {
        return {
          displayStart: focusMonthStart,
          displayEnd: focusMonthEnd,
          focusStart,
          focusEnd,
        }
      }

      const extraMonths = customContextMonthCount - focusMonthCount
      const beforeMonths = Math.floor(extraMonths * 0.4)
      const afterMonths = extraMonths - beforeMonths

      return {
        displayStart: focusMonthStart.subtract(beforeMonths, 'month'),
        displayEnd: focusMonthEnd.add(afterMonths, 'month'),
        focusStart,
        focusEnd,
      }
    }

    return {
      displayStart: focusMonthStart.startOf('year'),
      displayEnd: focusMonthEnd.endOf('year'),
      focusStart,
      focusEnd,
    }
  }

  return {
    displayStart: focusStart,
    displayEnd: focusEnd,
    focusStart,
    focusEnd,
  }
}

export function buildReportHeatmapCells(
  report: RangeReport | null,
  points: ReportHeatmapPoint[],
  customContextMonthCount = REPORT_HEATMAP_CUSTOM_CONTEXT_MONTH_COUNT,
): ReportHeatmapCell[] {
  const displayRange = buildReportHeatmapDisplayRange(report, customContextMonthCount)

  if (!report || !displayRange) {
    return []
  }

  const pointMap = new Map(points.map((point) => [point.date, point.value]))
  const { displayStart, displayEnd, focusStart, focusEnd } = displayRange
  const gridStart = displayStart.subtract((displayStart.day() + 6) % 7, 'day')
  const gridEnd = displayEnd.add(6 - ((displayEnd.day() + 6) % 7), 'day')
  const totalDays = gridEnd.diff(gridStart, 'day') + 1

  return Array.from({ length: totalDays }, (_, index) => {
    const currentDate = gridStart.add(index, 'day')
    const dateKey = currentDate.format('YYYY-MM-DD')
    const value = pointMap.get(dateKey) ?? 0

    return {
      date: dateKey,
      value,
      level: getReportHeatLevel(value),
      isInDisplayRange:
        !currentDate.isBefore(displayStart, 'day') && !currentDate.isAfter(displayEnd, 'day'),
      isInFocusRange:
        !currentDate.isBefore(focusStart, 'day') && !currentDate.isAfter(focusEnd, 'day'),
    }
  })
}

export function buildReportHeatmapMonthLabels(cells: ReportHeatmapCell[]) {
  const labels: Array<{ key: string; label: string; column: number }> = []
  let lastMonthKey = ''
  let lastYear: number | null = null
  let spansMultipleYears = false

  const inRangeCells = cells.filter((cell) => cell.isInDisplayRange)
  if (inRangeCells.length > 0) {
    spansMultipleYears =
      dayjs(inRangeCells[0].date).year() !== dayjs(inRangeCells[inRangeCells.length - 1].date).year()
  }

  for (let index = 0; index < cells.length; index += 7) {
    const weekCells = cells.slice(index, index + 7)
    const firstInRangeCell = weekCells.find((cell) => cell.isInDisplayRange)

    if (!firstInRangeCell) {
      continue
    }

    const monthKey = firstInRangeCell.date.slice(0, 7)
    if (monthKey === lastMonthKey) {
      continue
    }

    const currentDate = dayjs(firstInRangeCell.date)
    const year = currentDate.year()
    const shouldShowYear = spansMultipleYears && year !== lastYear

    labels.push({
      key: monthKey,
      label: shouldShowYear ? `${year}年${currentDate.month() + 1}月` : `${currentDate.month() + 1}月`,
      column: index / 7 + 1,
    })

    lastMonthKey = monthKey
    lastYear = year
  }

  return labels
}
