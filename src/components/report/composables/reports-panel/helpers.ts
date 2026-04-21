import dayjs from 'dayjs'
import {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  type GenerateRangeReportInput,
  type RangeReport,
  type ReportListItem,
  type ReportPreset,
  type ReportSectionKey,
} from '../../../../types/report'
import { normalizeSelectedSections } from './options'

export function buildEmptyStateTitle(preset: ReportPreset, selectedPeriodHasReport: boolean) {
  if (preset === 'month' && !selectedPeriodHasReport) {
    return '本月报告未生成'
  }

  if (preset === 'year' && !selectedPeriodHasReport) {
    return '本年报告未生成'
  }

  return '还没有打开任何报告'
}

export function buildEmptyStateDescription(
  preset: ReportPreset,
  selectedPeriodHasReport: boolean,
  monthValue: string,
  yearValue: string,
) {
  if (preset === 'month' && !selectedPeriodHasReport) {
    const monthDate = dayjs(`${monthValue}-01`)
    const label = monthDate.isValid() ? monthDate.format('YYYY 年 M 月') : monthValue
    return `${label} 还没有已保存的月度总结，你可以在左侧菜单处生成。`
  }

  if (preset === 'year' && !selectedPeriodHasReport) {
    const yearDate = dayjs(`${yearValue}-01-01`)
    const label = yearDate.isValid() ? yearDate.format('YYYY 年') : yearValue
    return `${label} 还没有已保存的年度总结，你可以在左侧菜单处生成。`
  }

  return '你可以先从左侧生成一份月度、年度或自定义区间总结。'
}

export function createReportInput(params: {
  workspacePath: string | null
  preset: ReportPreset
  monthValue: string
  yearValue: string
  customStartDate: string
  customEndDate: string
  selectedSections: ReportSectionKey[]
}): {
  input: GenerateRangeReportInput | null
  message: string
} {
  const {
    workspacePath,
    preset,
    monthValue,
    yearValue,
    customStartDate,
    customEndDate,
    selectedSections,
  } = params

  if (!workspacePath) {
    return {
      input: null,
      message: '请先选择一个工作区。',
    }
  }

  if (preset === 'month') {
    const monthDate = dayjs(`${monthValue}-01`)
    if (!monthDate.isValid()) {
      return {
        input: null,
        message: '请选择有效的月份。',
      }
    }

    return {
      input: {
        workspacePath,
        preset: 'month',
        startDate: monthDate.startOf('month').format('YYYY-MM-DD'),
        endDate: monthDate.endOf('month').format('YYYY-MM-DD'),
        requestedSections: normalizeSelectedSections(selectedSections),
        overwriteReportId: null,
      },
      message: '',
    }
  }

  if (preset === 'year') {
    const yearDate = dayjs(`${yearValue}-01-01`)
    if (!yearDate.isValid()) {
      return {
        input: null,
        message: '请选择有效的年份。',
      }
    }

    return {
      input: {
        workspacePath,
        preset: 'year',
        startDate: yearDate.startOf('year').format('YYYY-MM-DD'),
        endDate: yearDate.endOf('year').format('YYYY-MM-DD'),
        requestedSections: normalizeSelectedSections(selectedSections),
        overwriteReportId: null,
      },
      message: '',
    }
  }

  if (!customStartDate || !customEndDate) {
    return {
      input: null,
      message: '请选择完整的开始和结束日期。',
    }
  }

  const startDate = dayjs(customStartDate)
  const endDate = dayjs(customEndDate)

  if (!startDate.isValid() || !endDate.isValid()) {
    return {
      input: null,
      message: '自定义区间无效。',
    }
  }

  if (endDate.isBefore(startDate, 'day')) {
    return {
      input: null,
      message: '结束日期不能早于开始日期。',
    }
  }

  if (endDate.isAfter(startDate.add(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year'), 'day')) {
    return {
      input: null,
      message: `自定义区间跨度不能超过${MAX_CUSTOM_REPORT_RANGE_YEARS}年。`,
    }
  }

  return {
    input: {
      workspacePath,
      preset: 'custom',
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      requestedSections: normalizeSelectedSections(selectedSections),
      overwriteReportId: null,
    },
    message: '',
  }
}

export function findExistingReportForInput(params: {
  input: GenerateRangeReportInput
  selectedMonthReport: ReportListItem | null
  selectedYearReport: ReportListItem | null
  customReportList: ReportListItem[]
}) {
  const { input, selectedMonthReport, selectedYearReport, customReportList } = params

  if (input.preset === 'month') {
    return selectedMonthReport
  }

  if (input.preset === 'year') {
    return selectedYearReport
  }

  return (
    customReportList.find(
      (item) => item.startDate === input.startDate && item.endDate === input.endDate,
    ) ?? null
  )
}

export function buildOverwriteConfirmMessage(
  input: GenerateRangeReportInput,
  existingReport: ReportListItem,
) {
  if (input.preset === 'month' || input.preset === 'year') {
    return `${existingReport.label}已存在，重新生成会覆盖原有报告。要继续吗？`
  }

  return `${input.startDate} 至 ${input.endDate} 的报告已存在，重新生成会覆盖原有报告。要继续吗？`
}

export function isActiveReportMatchingInput(
  activeReport: RangeReport | null,
  input: GenerateRangeReportInput,
) {
  return (
    activeReport?.preset === input.preset &&
    activeReport.period.startDate === input.startDate &&
    activeReport.period.endDate === input.endDate
  )
}

export function resolveNextSelectedCustomReportId(
  selectedReportId: string | null,
  customReportList: ReportListItem[],
) {
  return selectedReportId &&
    customReportList.some((item) => item.reportId === selectedReportId)
    ? selectedReportId
    : customReportList[0]?.reportId ?? null
}
