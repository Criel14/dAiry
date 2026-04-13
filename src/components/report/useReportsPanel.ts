import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type {
  GenerateRangeReportInput,
  RangeReport,
  ReportListItem,
  ReportPreset,
  ReportSectionKey,
} from '../../types/dairy'

export const REPORT_SECTION_OPTIONS: Array<{
  key: ReportSectionKey
  label: string
  description: string
}> = [
  { key: 'stats', label: '基础统计', description: '记录天数、总字数、连续记录等' },
  { key: 'heatmap', label: '字数热力图', description: '按日期查看区间内写作分布' },
  { key: 'moodTrend', label: '情绪变化', description: '按日期查看心情分布与均值' },
  { key: 'tagCloud', label: '标签词云', description: '汇总高频标签，便于看主题集中度' },
  { key: 'highlights', label: '重点事件', description: '从区间内挑出更值得回看的几天' },
  { key: 'locationPatterns', label: '地点分析', description: '汇总区间内最常写作和最独特的地点' },
  { key: 'timePatterns', label: '时间段分析', description: '查看写作主要集中在一天中的哪个时间段' },
]

export function useReportsPanel(workspacePath: Ref<string | null>) {
  const preset = ref<ReportPreset>('month')
  const monthValue = ref(dayjs().format('YYYY-MM'))
  const yearValue = ref(dayjs().format('YYYY'))
  const customStartDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
  const customEndDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'))
  const selectedSections = ref<ReportSectionKey[]>([
    'stats',
    'heatmap',
    'moodTrend',
    'tagCloud',
    'highlights',
    'locationPatterns',
    'timePatterns',
  ])
  const reportList = ref<ReportListItem[]>([])
  const activeReport = ref<RangeReport | null>(null)
  const selectedReportId = ref<string | null>(null)
  const isLoadingList = ref(false)
  const isLoadingReport = ref(false)
  const isGenerating = ref(false)
  const statusMessage = ref('')

  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const activeStats = computed(() => activeReport.value?.sections.stats ?? null)
  const activeHeatmapPoints = computed(() => activeReport.value?.sections.heatmap?.points ?? [])
  const activeMoodPoints = computed(() => activeReport.value?.sections.moodTrend?.points ?? [])
  const activeTagItems = computed(() => activeReport.value?.sections.tagCloud?.items ?? [])
  const activeHighlights = computed(() => activeReport.value?.sections.highlights?.events ?? [])
  const activeLocationPatterns = computed(() => activeReport.value?.sections.locationPatterns ?? null)
  const activeTimePatterns = computed(() => activeReport.value?.sections.timePatterns ?? null)

  watch(
    workspacePath,
    () => {
      void handleWorkspaceChange()
    },
    { immediate: true },
  )

  async function handleWorkspaceChange() {
    reportList.value = []
    activeReport.value = null
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

      const nextSelectedReportId =
        selectedReportId.value &&
        nextReports.some((item) => item.reportId === selectedReportId.value)
          ? selectedReportId.value
          : nextReports[0]?.reportId ?? null

      selectedReportId.value = nextSelectedReportId

      if (nextSelectedReportId) {
        await loadReport(nextSelectedReportId)
        return
      }

      activeReport.value = null
    } catch (error) {
      reportList.value = []
      activeReport.value = null
      statusMessage.value = error instanceof Error ? error.message : '读取报告列表失败，请稍后重试。'
    } finally {
      isLoadingList.value = false
    }
  }

  async function loadReport(reportId: string) {
    if (!workspacePath.value) {
      return
    }

    isLoadingReport.value = true
    statusMessage.value = ''

    try {
      activeReport.value = await window.dairy.getRangeReport({
        workspacePath: workspacePath.value,
        reportId,
      })
      selectedReportId.value = reportId
    } catch (error) {
      activeReport.value = null
      statusMessage.value = error instanceof Error ? error.message : '读取报告详情失败，请稍后重试。'
    } finally {
      isLoadingReport.value = false
    }
  }

  function toggleSection(sectionKey: ReportSectionKey) {
    if (selectedSections.value.includes(sectionKey)) {
      if (selectedSections.value.length === 1) {
        return
      }

      selectedSections.value = selectedSections.value.filter((item) => item !== sectionKey)
      return
    }

    selectedSections.value = [...selectedSections.value, sectionKey]
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
        requestedSections: [...selectedSections.value],
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
        requestedSections: [...selectedSections.value],
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

    return {
      workspacePath: workspacePath.value,
      preset: 'custom',
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      requestedSections: [...selectedSections.value],
    }
  }

  async function handleGenerateReport() {
    const input = createReportInput()
    if (!input) {
      return
    }

    isGenerating.value = true
    statusMessage.value = ''

    try {
      const report = await window.dairy.generateRangeReport(input)
      activeReport.value = report
      selectedReportId.value = report.reportId
      statusMessage.value = '报告已生成并保存到工作区。'
      await loadReportList()
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '生成报告失败，请稍后重试。'
    } finally {
      isGenerating.value = false
    }
  }

  return {
    activeHeatmapPoints,
    activeHighlights,
    activeLocationPatterns,
    activeMoodPoints,
    activeReport,
    activeStats,
    activeTagItems,
    activeTimePatterns,
    customEndDate,
    customStartDate,
    handleGenerateReport,
    hasWorkspace,
    isGenerating,
    isLoadingList,
    isLoadingReport,
    loadReport,
    monthValue,
    preset,
    reportList,
    sectionOptions: REPORT_SECTION_OPTIONS,
    selectedReportId,
    selectedSections,
    statusMessage,
    toggleSection,
    yearValue,
  }
}
