import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import {
  type RangeReport,
  type ReportListItem,
  type ReportPreset,
  type ReportSectionKey,
} from '../../../types/report'
import { getReadableErrorMessage } from '../../../utils/error'
import {
  buildEmptyStateDescription,
  buildEmptyStateTitle,
  buildOverwriteConfirmMessage,
  createReportInput,
  findExistingReportForInput,
  isActiveReportMatchingInput,
  resolveNextSelectedCustomReportId,
} from './reports-panel/helpers'
import {
  normalizeSelectedSections,
  REPORT_SECTION_OPTIONS,
  REQUIRED_REPORT_SECTION,
} from './reports-panel/options'

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
  const emptyStateTitle = computed(() =>
    buildEmptyStateTitle(preset.value, selectedPeriodHasReport.value),
  )
  const emptyStateDescription = computed(() =>
    buildEmptyStateDescription(
      preset.value,
      selectedPeriodHasReport.value,
      monthValue.value,
      yearValue.value,
    ),
  )
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
      selectedReportId.value = resolveNextSelectedCustomReportId(
        selectedReportId.value,
        nextReports.filter((item) => item.preset === 'custom'),
      )
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

    const nextSelectedReportId = resolveNextSelectedCustomReportId(
      selectedReportId.value,
      customReportList.value,
    )

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

  async function handleGenerateReport() {
    const { input, message } = createReportInput({
      workspacePath: workspacePath.value,
      preset: preset.value,
      monthValue: monthValue.value,
      yearValue: yearValue.value,
      customStartDate: customStartDate.value,
      customEndDate: customEndDate.value,
      selectedSections: selectedSections.value,
    })
    if (!input) {
      statusMessage.value = message
      return
    }

    const existingReport = findExistingReportForInput({
      input,
      selectedMonthReport: selectedMonthReport.value,
      selectedYearReport: selectedYearReport.value,
      customReportList: customReportList.value,
    })
    if (existingReport) {
      const shouldOverwrite = window.confirm(buildOverwriteConfirmMessage(input, existingReport))
      if (!shouldOverwrite) {
        return
      }

      input.overwriteReportId = existingReport.reportId
    }

    if (input.preset === 'custom' && !isActiveReportMatchingInput(activeReport.value, input)) {
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
