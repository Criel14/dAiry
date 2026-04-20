import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  type GenerateRangeReportInput,
  type RangeReport,
  type ReportListItem,
  type ReportPreset,
  type ReportSectionKey,
} from '../../../types/report'
import { getReadableErrorMessage } from '../../../utils/error'

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

const REQUIRED_REPORT_SECTION: ReportSectionKey = 'stats'

function normalizeSelectedSections(sections: ReportSectionKey[]) {
  const uniqueSections = Array.from(new Set(sections))

  if (uniqueSections.includes(REQUIRED_REPORT_SECTION)) {
    return uniqueSections
  }

  return [REQUIRED_REPORT_SECTION, ...uniqueSections]
}

export function useReportsPanel(workspacePath: Ref<string | null>) {
  const preset = ref<ReportPreset>('month')
  const monthValue = ref(dayjs().format('YYYY-MM'))
  const yearValue = ref(dayjs().format('YYYY'))
  const customStartDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
  const customEndDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'))
  const selectedSections = ref<ReportSectionKey[]>(
    normalizeSelectedSections([
      'stats',
      'heatmap',
      'moodTrend',
      'tagCloud',
      'locationPatterns',
      'timePatterns',
    ]),
  )
  const reportList = ref<ReportListItem[]>([])
  const activeReport = ref<RangeReport | null>(null)
  const selectedReportId = ref<string | null>(null)
  const isLoadingList = ref(false)
  const isLoadingReport = ref(false)
  const isGenerating = ref(false)
  const statusMessage = ref('')
  let reportLoadSequence = 0

  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const monthReports = computed(() => reportList.value.filter((item) => item.preset === 'month'))
  const yearReports = computed(() => reportList.value.filter((item) => item.preset === 'year'))
  const customReportList = computed(() => reportList.value.filter((item) => item.preset === 'custom'))
  const selectedMonthReportId = computed(() => `month_${monthValue.value}`)
  const selectedYearReportId = computed(() => `year_${yearValue.value}`)
  const selectedMonthReport = computed(
    () => monthReports.value.find((item) => item.reportId === selectedMonthReportId.value) ?? null,
  )
  const selectedYearReport = computed(
    () => yearReports.value.find((item) => item.reportId === selectedYearReportId.value) ?? null,
  )
  const selectedPeriodHasReport = computed(() => {
    if (preset.value === 'month') {
      return Boolean(selectedMonthReport.value)
    }

    if (preset.value === 'year') {
      return Boolean(selectedYearReport.value)
    }

    return Boolean(selectedReportId.value)
  })
  const emptyStateTitle = computed(() => {
    if (preset.value === 'month' && !selectedPeriodHasReport.value) {
      return '本月报告未生成'
    }

    if (preset.value === 'year' && !selectedPeriodHasReport.value) {
      return '本年报告未生成'
    }

    return '还没有打开任何报告'
  })
  const emptyStateDescription = computed(() => {
    if (preset.value === 'month' && !selectedPeriodHasReport.value) {
      const monthDate = dayjs(`${monthValue.value}-01`)
      const label = monthDate.isValid() ? monthDate.format('YYYY 年 M 月') : monthValue.value
      return `${label} 还没有已保存的月度总结，你可以在左侧菜单处生成。`
    }

    if (preset.value === 'year' && !selectedPeriodHasReport.value) {
      const yearDate = dayjs(`${yearValue.value}-01-01`)
      const label = yearDate.isValid() ? yearDate.format('YYYY 年') : yearValue.value
      return `${label} 还没有已保存的年度总结，你可以在左侧菜单处生成。`
    }

    return '你可以先从左侧生成一份月度、年度或自定义区间总结。'
  })
  const activeStats = computed(() => activeReport.value?.sections.stats ?? null)
  const activeHeatmapPoints = computed(() => activeReport.value?.sections.heatmap?.points ?? [])
  const activeMoodPoints = computed(() => activeReport.value?.sections.moodTrend?.points ?? [])
  const activeTagItems = computed(() => activeReport.value?.sections.tagCloud?.items ?? [])
  const activeLocationPatterns = computed(() => activeReport.value?.sections.locationPatterns ?? null)
  const activeTimePatterns = computed(() => activeReport.value?.sections.timePatterns ?? null)

  watch(
    workspacePath,
    () => {
      void handleWorkspaceChange()
    },
    { immediate: true },
  )

  watch(
    [preset, monthValue, yearValue, selectedReportId, reportList, workspacePath],
    () => {
      void syncActiveReportForSelection()
    },
    { immediate: true },
  )

  async function handleWorkspaceChange() {
    reportList.value = []
    clearActiveReport()
    selectedReportId.value = null
    statusMessage.value = ''

    if (!workspacePath.value) {
      return
    }

    await loadReportList()
  }

  async function loadReportList() {
    if (!workspacePath.value) {
      reportList.value = []
      return
    }

    isLoadingList.value = true

    try {
      const nextReports = await window.dairy.listRangeReports(workspacePath.value)
      reportList.value = nextReports
      const nextCustomReportId =
        selectedReportId.value &&
        nextReports.some((item) => item.preset === 'custom' && item.reportId === selectedReportId.value)
          ? selectedReportId.value
          : nextReports.find((item) => item.preset === 'custom')?.reportId ?? null

      selectedReportId.value = nextCustomReportId
    } catch (error) {
      reportList.value = []
      clearActiveReport()
      statusMessage.value = getReadableErrorMessage(error, '读取报告列表失败，请稍后重试。')
    } finally {
      isLoadingList.value = false
    }
  }

  function clearActiveReport() {
    reportLoadSequence += 1
    activeReport.value = null
    isLoadingReport.value = false
  }

  async function loadReport(reportId: string, options: { syncCustomSelection?: boolean } = {}) {
    if (!workspacePath.value) {
      return
    }

    const currentLoad = ++reportLoadSequence
    isLoadingReport.value = true
    statusMessage.value = ''

    try {
      const report = await window.dairy.getRangeReport({
        workspacePath: workspacePath.value,
        reportId,
      })

      if (currentLoad !== reportLoadSequence) {
        return
      }

      activeReport.value = report

      if (options.syncCustomSelection ?? true) {
        selectedReportId.value = reportId
      }
    } catch (error) {
      if (currentLoad !== reportLoadSequence) {
        return
      }

      activeReport.value = null
      statusMessage.value = getReadableErrorMessage(error, '读取报告详情失败，请稍后重试。')
    } finally {
      if (currentLoad === reportLoadSequence) {
        isLoadingReport.value = false
      }
    }
  }

  async function syncActiveReportForSelection() {
    if (!workspacePath.value) {
      clearActiveReport()
      return
    }

    if (preset.value === 'month') {
      if (!selectedMonthReport.value) {
        statusMessage.value = ''
        clearActiveReport()
        return
      }

      if (activeReport.value?.reportId === selectedMonthReport.value.reportId) {
        return
      }

      await loadReport(selectedMonthReport.value.reportId, { syncCustomSelection: false })
      return
    }

    if (preset.value === 'year') {
      if (!selectedYearReport.value) {
        statusMessage.value = ''
        clearActiveReport()
        return
      }

      if (activeReport.value?.reportId === selectedYearReport.value.reportId) {
        return
      }

      await loadReport(selectedYearReport.value.reportId, { syncCustomSelection: false })
      return
    }

    const nextSelectedReportId =
      selectedReportId.value &&
      customReportList.value.some((item) => item.reportId === selectedReportId.value)
        ? selectedReportId.value
        : customReportList.value[0]?.reportId ?? null

    if (selectedReportId.value !== nextSelectedReportId) {
      selectedReportId.value = nextSelectedReportId
    }

    if (!nextSelectedReportId) {
      statusMessage.value = ''
      clearActiveReport()
      return
    }

    if (activeReport.value?.reportId === nextSelectedReportId) {
      return
    }

    await loadReport(nextSelectedReportId)
  }

  function toggleSection(sectionKey: ReportSectionKey) {
    if (sectionKey === REQUIRED_REPORT_SECTION) {
      selectedSections.value = normalizeSelectedSections(selectedSections.value)
      return
    }

    if (selectedSections.value.includes(sectionKey)) {
      selectedSections.value = normalizeSelectedSections(
        selectedSections.value.filter((item) => item !== sectionKey),
      )
      return
    }

    selectedSections.value = normalizeSelectedSections([...selectedSections.value, sectionKey])
  }

  function createReportInput(): GenerateRangeReportInput | null {
    if (!workspacePath.value) {
      statusMessage.value = '请先选择一个工作区。'
      return null
    }

    if (preset.value === 'month') {
      const monthDate = dayjs(`${monthValue.value}-01`)
      if (!monthDate.isValid()) {
        statusMessage.value = '请选择有效的月份。'
        return null
      }

      return {
        workspacePath: workspacePath.value,
        preset: 'month',
        startDate: monthDate.startOf('month').format('YYYY-MM-DD'),
        endDate: monthDate.endOf('month').format('YYYY-MM-DD'),
        requestedSections: normalizeSelectedSections(selectedSections.value),
        overwriteReportId: null,
      }
    }

    if (preset.value === 'year') {
      const yearDate = dayjs(`${yearValue.value}-01-01`)
      if (!yearDate.isValid()) {
        statusMessage.value = '请选择有效的年份。'
        return null
      }

      return {
        workspacePath: workspacePath.value,
        preset: 'year',
        startDate: yearDate.startOf('year').format('YYYY-MM-DD'),
        endDate: yearDate.endOf('year').format('YYYY-MM-DD'),
        requestedSections: normalizeSelectedSections(selectedSections.value),
        overwriteReportId: null,
      }
    }

    if (!customStartDate.value || !customEndDate.value) {
      statusMessage.value = '请选择完整的开始和结束日期。'
      return null
    }

    const startDate = dayjs(customStartDate.value)
    const endDate = dayjs(customEndDate.value)

    if (!startDate.isValid() || !endDate.isValid()) {
      statusMessage.value = '自定义区间无效。'
      return null
    }

    if (endDate.isBefore(startDate, 'day')) {
      statusMessage.value = '结束日期不能早于开始日期。'
      return null
    }

    if (endDate.isAfter(startDate.add(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year'), 'day')) {
      statusMessage.value = `自定义区间跨度不能超过${MAX_CUSTOM_REPORT_RANGE_YEARS}年。`
      return null
    }

    return {
      workspacePath: workspacePath.value,
      preset: 'custom',
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      requestedSections: normalizeSelectedSections(selectedSections.value),
      overwriteReportId: null,
    }
  }

  function findExistingReportForInput(input: GenerateRangeReportInput) {
    if (input.preset === 'month') {
      return selectedMonthReport.value
    }

    if (input.preset === 'year') {
      return selectedYearReport.value
    }

    return customReportList.value.find(
      (item) => item.startDate === input.startDate && item.endDate === input.endDate,
    ) ?? null
  }

  function buildOverwriteConfirmMessage(
    input: GenerateRangeReportInput,
    existingReport: ReportListItem,
  ) {
    if (input.preset === 'month') {
      return `${existingReport.label}已存在，重新生成会覆盖原有报告。要继续吗？`
    }

    if (input.preset === 'year') {
      return `${existingReport.label}已存在，重新生成会覆盖原有报告。要继续吗？`
    }

    return `${input.startDate} 至 ${input.endDate} 的报告已存在，重新生成会覆盖原有报告。要继续吗？`
  }

  function isActiveReportMatchingInput(input: GenerateRangeReportInput) {
    return (
      activeReport.value?.preset === input.preset &&
      activeReport.value.period.startDate === input.startDate &&
      activeReport.value.period.endDate === input.endDate
    )
  }

  async function handleGenerateReport() {
    const input = createReportInput()
    if (!input) {
      return
    }

    const existingReport = findExistingReportForInput(input)
    if (existingReport) {
      const shouldOverwrite = window.confirm(buildOverwriteConfirmMessage(input, existingReport))
      if (!shouldOverwrite) {
        return
      }

      input.overwriteReportId = existingReport.reportId
    }

    if (input.preset === 'custom' && !isActiveReportMatchingInput(input)) {
      clearActiveReport()
      selectedReportId.value = null
    }

    isGenerating.value = true
    statusMessage.value = ''

    try {
      const report = await window.dairy.generateRangeReport(input)
      activeReport.value = report
      if (report.preset === 'custom') {
        selectedReportId.value = report.reportId
      }
      statusMessage.value = '报告已生成并保存到工作区。'
      await loadReportList()
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '生成报告失败，请稍后重试。')
    } finally {
      isGenerating.value = false
    }
  }

  return {
    activeHeatmapPoints,
    activeLocationPatterns,
    activeMoodPoints,
    activeReport,
    activeStats,
    activeTagItems,
    activeTimePatterns,
    customReportList,
    customEndDate,
    customStartDate,
    emptyStateDescription,
    emptyStateTitle,
    handleGenerateReport,
    hasWorkspace,
    isGenerating,
    isLoadingList,
    isLoadingReport,
    loadReport,
    monthReports,
    monthValue,
    preset,
    reportList,
    sectionOptions: REPORT_SECTION_OPTIONS,
    selectedPeriodHasReport,
    selectedReportId,
    selectedSections,
    statusMessage,
    toggleSection,
    yearReports,
    yearValue,
  }
}
