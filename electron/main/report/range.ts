import dayjs, { type Dayjs } from 'dayjs'
import {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  type GenerateRangeReportInput,
  type ReportSectionKey,
} from '../../../src/types/report'
import { assertValidDate, assertValidMonth, assertValidYear } from '../workspace-paths'

const ALLOWED_REPORT_SECTIONS: ReportSectionKey[] = [
  'stats',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'locationPatterns',
  'timePatterns',
]

export function normalizeRequestedSections(sections: ReportSectionKey[]) {
  const uniqueSections = new Set<ReportSectionKey>()

  for (const section of sections) {
    if (ALLOWED_REPORT_SECTIONS.includes(section)) {
      uniqueSections.add(section)
    }
  }

  return uniqueSections.size > 0 ? [...uniqueSections] : ALLOWED_REPORT_SECTIONS
}

export function validateReportRange(input: GenerateRangeReportInput) {
  if (!input.workspacePath.trim()) {
    throw new Error('当前还没有可用的工作区。')
  }

  assertValidDate(input.startDate)
  assertValidDate(input.endDate)

  const startDate = dayjs(input.startDate)
  const endDate = dayjs(input.endDate)

  if (!startDate.isValid() || !endDate.isValid()) {
    throw new Error('报告区间无效。')
  }

  if (endDate.isBefore(startDate, 'day')) {
    throw new Error('结束日期不能早于开始日期。')
  }

  if (input.preset === 'month') {
    const monthKey = startDate.format('YYYY-MM')
    assertValidMonth(monthKey)

    if (
      !startDate.isSame(startDate.startOf('month'), 'day') ||
      !endDate.isSame(startDate.endOf('month'), 'day')
    ) {
      throw new Error('月度报告的区间必须覆盖完整自然月。')
    }
  }

  if (input.preset === 'year') {
    const yearKey = startDate.format('YYYY')
    assertValidYear(yearKey)

    if (
      !startDate.isSame(startDate.startOf('year'), 'day') ||
      !endDate.isSame(startDate.endOf('year'), 'day')
    ) {
      throw new Error('年度报告的区间必须覆盖完整自然年。')
    }
  }

  if (
    input.preset === 'custom' &&
    endDate.isAfter(startDate.add(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year'), 'day')
  ) {
    throw new Error(`自定义区间跨度不能超过${MAX_CUSTOM_REPORT_RANGE_YEARS}年。`)
  }

  return {
    startDate,
    endDate,
    requestedSections: normalizeRequestedSections(input.requestedSections),
  }
}

export function listDatesInRange(startDate: Dayjs, endDate: Dayjs) {
  const dates: string[] = []
  let currentDate = startDate.startOf('day')

  while (currentDate.isSame(endDate, 'day') || currentDate.isBefore(endDate, 'day')) {
    dates.push(currentDate.format('YYYY-MM-DD'))
    currentDate = currentDate.add(1, 'day')
  }

  return dates
}

export function formatReportLabel(
  preset: GenerateRangeReportInput['preset'],
  startDate: Dayjs,
  endDate: Dayjs,
) {
  if (preset === 'month') {
    return `${startDate.format('YYYY 年 M 月')}总结`
  }

  if (preset === 'year') {
    return `${startDate.format('YYYY 年')}总结`
  }

  return `${startDate.format('YYYY 年 M 月 D 日')} 至 ${endDate.format('YYYY 年 M 月 D 日')}总结`
}

export function buildEmptyReportMessage(
  preset: GenerateRangeReportInput['preset'],
  startDate: Dayjs,
  endDate: Dayjs,
) {
  if (preset === 'month') {
    return `${startDate.format('YYYY 年 M 月')}没有任何日记，无法生成报告。`
  }

  if (preset === 'year') {
    return `${startDate.format('YYYY 年')}没有任何日记，无法生成报告。`
  }

  return `${startDate.format('YYYY-MM-DD')} 至 ${endDate.format('YYYY-MM-DD')} 这段时间没有任何日记，无法生成报告。`
}

function createReportId(
  preset: GenerateRangeReportInput['preset'],
  startDate: Dayjs,
  endDate: Dayjs,
) {
  if (preset === 'month') {
    return `month_${startDate.format('YYYY-MM')}`
  }

  if (preset === 'year') {
    return `year_${startDate.format('YYYY')}`
  }

  return `custom_${startDate.format('YYYY-MM-DD')}_${endDate.format('YYYY-MM-DD')}_${Date.now()}`
}

export function resolveTargetReportId(
  input: GenerateRangeReportInput,
  startDate: Dayjs,
  endDate: Dayjs,
) {
  if (input.preset === 'custom' && input.overwriteReportId?.trim()) {
    return input.overwriteReportId.trim()
  }

  return createReportId(input.preset, startDate, endDate)
}

export function getReportTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
}
