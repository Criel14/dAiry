import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  type ReportListItem,
  type ReportPreset,
  type ReportSectionKey,
} from '../../../types/dairy'

export interface ReportsSidebarProps {
  hasWorkspace: boolean
  preset: ReportPreset
  monthValue: string
  yearValue: string
  customStartDate: string
  customEndDate: string
  selectedSections: ReportSectionKey[]
  sectionOptions: Array<{
    key: ReportSectionKey
    label: string
    description: string
  }>
  monthReports: ReportListItem[]
  yearReports: ReportListItem[]
  customReportList: ReportListItem[]
  selectedReportId: string | null
  isLoadingList: boolean
  isGenerating: boolean
  statusMessage: string
}

export type ReportsSidebarEmits = {
  'update:preset': [value: ReportPreset]
  'update:monthValue': [value: string]
  'update:yearValue': [value: string]
  'update:customStartDate': [value: string]
  'update:customEndDate': [value: string]
  toggleSection: [value: ReportSectionKey]
  selectReport: [reportId: string]
  generate: []
}

type ReportsSidebarEmitFn = <K extends keyof ReportsSidebarEmits>(
  event: K,
  ...args: ReportsSidebarEmits[K]
) => void

const monthLabels = [
  '1 月',
  '2 月',
  '3 月',
  '4 月',
  '5 月',
  '6 月',
  '7 月',
  '8 月',
  '9 月',
  '10 月',
  '11 月',
  '12 月',
]

export function useReportsSidebar(props: ReportsSidebarProps, emit: ReportsSidebarEmitFn) {
  const isSectionOptionsExpanded = ref(false)
  const monthPickerYear = ref(parseMonthYear(props.monthValue))
  const yearPickerStart = ref(getYearPageStart(parseYearValue(props.yearValue)))

  watch(
    () => props.monthValue,
    (value) => {
      monthPickerYear.value = parseMonthYear(value)
    },
    { immediate: true },
  )

  watch(
    () => props.yearValue,
    (value) => {
      yearPickerStart.value = getYearPageStart(parseYearValue(value))
    },
    { immediate: true },
  )

  const selectedSectionSummary = computed(() => {
    const selectedCount = new Set(['stats', ...props.selectedSections]).size

    if (selectedCount === 0) {
      return '暂未选择'
    }

    return `已选 ${selectedCount} 项`
  })

  const monthReportKeys = computed(
    () => new Set(props.monthReports.map((item) => dayjs(item.startDate).format('YYYY-MM'))),
  )
  const yearReportKeys = computed(
    () => new Set(props.yearReports.map((item) => dayjs(item.startDate).format('YYYY'))),
  )
  const monthPickerTitle = computed(() => `${monthPickerYear.value} 年`)
  const yearPickerTitle = computed(() => `${yearPickerStart.value} - ${yearPickerStart.value + 11}`)
  const customStartMinDate = computed(() => {
    const endDate = dayjs(props.customEndDate)
    return endDate.isValid()
      ? endDate.subtract(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year').format('YYYY-MM-DD')
      : undefined
  })
  const customEndMaxDate = computed(() => {
    const startDate = dayjs(props.customStartDate)
    return startDate.isValid()
      ? startDate.add(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year').format('YYYY-MM-DD')
      : undefined
  })

  const monthCells = computed(() =>
    monthLabels.map((label, index) => {
      const date = dayjs().year(monthPickerYear.value).month(index).startOf('month')
      const key = date.format('YYYY-MM')

      return {
        key,
        label,
        isSelected: key === props.monthValue,
        isCurrent: key === dayjs().format('YYYY-MM'),
        hasReport: monthReportKeys.value.has(key),
      }
    }),
  )

  const yearCells = computed(() =>
    Array.from({ length: 12 }, (_, index) => {
      const year = yearPickerStart.value + index
      const key = `${year}`

      return {
        key,
        label: `${year} 年`,
        isSelected: key === props.yearValue,
        isCurrent: key === dayjs().format('YYYY'),
        hasReport: yearReportKeys.value.has(key),
      }
    }),
  )

  const generateButtonText = computed(() => {
    if (props.isGenerating) {
      return '正在生成'
    }

    if (props.preset === 'month') {
      return '生成当前月份报告'
    }

    if (props.preset === 'year') {
      return '生成当前年份报告'
    }

    return '生成并保存报告'
  })

  const isRequiredSection = (sectionKey: ReportSectionKey) => sectionKey === 'stats'
  const isSectionSelected = (sectionKey: ReportSectionKey) =>
    isRequiredSection(sectionKey) || props.selectedSections.includes(sectionKey)

  function shiftMonthPickerYear(amount: number) {
    monthPickerYear.value += amount
  }

  function selectMonth(key: string) {
    emit('update:monthValue', key)
  }

  function goToCurrentMonth() {
    const currentMonth = dayjs().format('YYYY-MM')
    monthPickerYear.value = dayjs().year()
    emit('update:monthValue', currentMonth)
  }

  function shiftYearPickerPage(amount: number) {
    yearPickerStart.value += amount * 12
  }

  function selectYear(key: string) {
    emit('update:yearValue', key)
  }

  function goToCurrentYear() {
    const currentYear = dayjs().format('YYYY')
    yearPickerStart.value = getYearPageStart(dayjs().year())
    emit('update:yearValue', currentYear)
  }

  return {
    MAX_CUSTOM_REPORT_RANGE_YEARS,
    customEndMaxDate,
    customStartMinDate,
    formatDateTime,
    generateButtonText,
    goToCurrentMonth,
    goToCurrentYear,
    isRequiredSection,
    isSectionOptionsExpanded,
    isSectionSelected,
    monthCells,
    monthPickerTitle,
    selectMonth,
    selectYear,
    selectedSectionSummary,
    shiftMonthPickerYear,
    shiftYearPickerPage,
    yearCells,
    yearPickerTitle,
  }
}

function parseMonthYear(value: string) {
  const parsedDate = dayjs(`${value}-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}

function parseYearValue(value: string) {
  const parsedDate = dayjs(`${value}-01-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}

function getYearPageStart(year: number) {
  return Math.floor(year / 12) * 12
}

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : value
}
