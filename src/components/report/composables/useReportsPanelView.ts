import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  RangeReport,
  ReportExportSectionKey,
  ReportHeatmapPoint,
  ReportLocationPatternsSection,
  ReportMoodPoint,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../../types/dairy'
import {
  REPORT_EXPORT_SECTION_OPTIONS,
  getAvailableExportSections,
  getDefaultExportSections,
} from '../config/export-config'
import {
  REPORT_HEATMAP_CELL_GAP,
  REPORT_HEATMAP_DEFAULT_CELL_SIZE,
  REPORT_HEATMAP_MAX_CELL_SIZE,
  REPORT_HEATMAP_MIN_CELL_SIZE,
  REPORT_HEATMAP_WEEKDAY_LABELS,
  buildReportHeatmapCells,
  buildReportHeatmapMonthLabels,
  buildReportSummaryGroups,
  buildReportTimeAnchorTitle,
  formatReportPreset,
  getReportMaxWordsInOneDay,
  getReportPatternCount,
  getReportRankingFillWidth,
  getReportSummaryItemKey,
} from '../shared/report-view'

export interface ReportsPanelProps {
  workspacePath: string | null
  hasWorkspace: boolean
  emptyStateTitle: string
  emptyStateDescription: string
  activeReport: RangeReport | null
  isLoadingReport: boolean
  activeStats: ReportStatsSection | null
  activeHeatmapPoints: ReportHeatmapPoint[]
  activeMoodPoints: ReportMoodPoint[]
  activeTagItems: ReportTagCloudItem[]
  activeLocationPatterns: ReportLocationPatternsSection | null
  activeTimePatterns: ReportTimePatternsSection | null
}

const DEFAULT_EXPORT_IMAGE_SCALE = '1.5'
const MIN_EXPORT_IMAGE_SCALE = 1
const MAX_EXPORT_IMAGE_SCALE = 3
const DEFAULT_EXPORT_DOCUMENT_WIDTH = '1200'
const MIN_EXPORT_DOCUMENT_WIDTH = 1000
const MAX_EXPORT_DOCUMENT_WIDTH = 2400
const maxPatternItems = 6

export function useReportsPanelView(props: ReportsPanelProps) {
  const activeSummaryGroups = computed(() => buildReportSummaryGroups(props.activeReport))

  const isExportDialogVisible = ref(false)
  const isExporting = ref(false)
  const exportDialogMessage = ref('')
  const selectedExportSections = ref<ReportExportSectionKey[]>([])
  const selectedExportDocumentWidth = ref(DEFAULT_EXPORT_DOCUMENT_WIDTH)
  const selectedExportImageScale = ref(DEFAULT_EXPORT_IMAGE_SCALE)
  const exportSectionOptions = REPORT_EXPORT_SECTION_OPTIONS

  const availableExportSections = computed(() => getAvailableExportSections(props.activeReport))
  const parsedExportDocumentWidth = computed(() =>
    parseExportDocumentWidth(selectedExportDocumentWidth.value),
  )
  const parsedExportImageScale = computed(() => parseExportImageScale(selectedExportImageScale.value))
  const canOpenExportDialog = computed(() => Boolean(props.activeReport) && !props.isLoadingReport)
  const canStartExport = computed(
    () =>
      Boolean(props.activeReport) &&
      Boolean(props.workspacePath?.trim()) &&
      selectedExportSections.value.length > 0 &&
      parsedExportDocumentWidth.value !== null &&
      parsedExportImageScale.value !== null &&
      !isExporting.value,
  )

  watch(
    () => props.activeReport?.reportId,
    () => {
      isExportDialogVisible.value = false
      exportDialogMessage.value = ''
      selectedExportSections.value = getDefaultExportSections(props.activeReport)
      selectedExportDocumentWidth.value = DEFAULT_EXPORT_DOCUMENT_WIDTH
      selectedExportImageScale.value = DEFAULT_EXPORT_IMAGE_SCALE
    },
    { immediate: true },
  )

  function openExportDialog() {
    if (!canOpenExportDialog.value) {
      return
    }

    exportDialogMessage.value = ''
    selectedExportSections.value = getDefaultExportSections(props.activeReport)
    selectedExportDocumentWidth.value = DEFAULT_EXPORT_DOCUMENT_WIDTH
    selectedExportImageScale.value = DEFAULT_EXPORT_IMAGE_SCALE
    isExportDialogVisible.value = true
  }

  function closeExportDialog() {
    if (isExporting.value) {
      return
    }

    exportDialogMessage.value = ''
    isExportDialogVisible.value = false
  }

  function isExportSectionSelected(sectionKey: ReportExportSectionKey) {
    return selectedExportSections.value.includes(sectionKey)
  }

  function isExportSectionAvailable(sectionKey: ReportExportSectionKey) {
    return availableExportSections.value.has(sectionKey)
  }

  function toggleExportSection(sectionKey: ReportExportSectionKey) {
    if (!isExportSectionAvailable(sectionKey) || isExporting.value) {
      return
    }

    if (isExportSectionSelected(sectionKey)) {
      selectedExportSections.value = selectedExportSections.value.filter((item) => item !== sectionKey)
      return
    }

    selectedExportSections.value = [...selectedExportSections.value, sectionKey]
  }

  function parseExportDocumentWidth(rawValue: string) {
    const trimmedValue = rawValue.trim()

    if (!trimmedValue) {
      return null
    }

    const parsedValue = Number(trimmedValue)

    if (!Number.isFinite(parsedValue)) {
      return null
    }

    if (parsedValue < MIN_EXPORT_DOCUMENT_WIDTH || parsedValue > MAX_EXPORT_DOCUMENT_WIDTH) {
      return null
    }

    return Math.round(parsedValue)
  }

  function parseExportImageScale(rawValue: string) {
    const trimmedValue = rawValue.trim()

    if (!trimmedValue) {
      return null
    }

    const parsedValue = Number(trimmedValue)

    if (!Number.isFinite(parsedValue)) {
      return null
    }

    if (parsedValue < MIN_EXPORT_IMAGE_SCALE || parsedValue > MAX_EXPORT_IMAGE_SCALE) {
      return null
    }

    return Math.round(parsedValue * 10) / 10
  }

  function formatExportImageScale(value: number) {
    const normalizedValue = Math.round(value * 10) / 10

    return Number.isInteger(normalizedValue)
      ? String(normalizedValue)
      : normalizedValue.toFixed(1)
  }

  function stepExportDocumentWidth(delta: number) {
    const currentValue =
      parseExportDocumentWidth(selectedExportDocumentWidth.value) ??
      Number(DEFAULT_EXPORT_DOCUMENT_WIDTH)
    const nextValue = Math.min(
      MAX_EXPORT_DOCUMENT_WIDTH,
      Math.max(MIN_EXPORT_DOCUMENT_WIDTH, currentValue + delta),
    )

    selectedExportDocumentWidth.value = String(Math.round(nextValue))
  }

  function stepExportImageScale(delta: number) {
    const currentValue =
      parseExportImageScale(selectedExportImageScale.value) ?? Number(DEFAULT_EXPORT_IMAGE_SCALE)
    const nextValue = Math.min(
      MAX_EXPORT_IMAGE_SCALE,
      Math.max(MIN_EXPORT_IMAGE_SCALE, currentValue + delta),
    )

    selectedExportImageScale.value = formatExportImageScale(nextValue)
  }

  async function handleExportReport() {
    if (!props.activeReport || !props.workspacePath?.trim()) {
      exportDialogMessage.value = '当前没有可导出的报告。'
      return
    }

    if (selectedExportSections.value.length === 0) {
      exportDialogMessage.value = '请至少选择一个导出内容。'
      return
    }

    if (parsedExportDocumentWidth.value === null) {
      exportDialogMessage.value = `导出宽度请输入 ${MIN_EXPORT_DOCUMENT_WIDTH} 到 ${MAX_EXPORT_DOCUMENT_WIDTH} 之间的数字。`
      return
    }

    if (parsedExportImageScale.value === null) {
      exportDialogMessage.value = `渲染倍率请输入 ${MIN_EXPORT_IMAGE_SCALE} 到 ${MAX_EXPORT_IMAGE_SCALE} 之间的数字。`
      return
    }

    isExporting.value = true
    exportDialogMessage.value = '正在准备图片...'

    try {
      const result = await window.dairy.exportRangeReportPng({
        workspacePath: props.workspacePath,
        reportId: props.activeReport.reportId,
        sections: [...selectedExportSections.value],
        documentWidth: parsedExportDocumentWidth.value,
        imageScale: parsedExportImageScale.value,
      })

      if (result.canceled) {
        exportDialogMessage.value = '已取消导出。'
        return
      }

      exportDialogMessage.value = '图片已导出。'
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请稍后重试。'
      exportDialogMessage.value = message
    } finally {
      isExporting.value = false
    }
  }

  const heatmapWeekdayLabels = REPORT_HEATMAP_WEEKDAY_LABELS
  const heatmapScrollerRef = ref<HTMLElement | null>(null)
  const heatmapCellSize = ref(REPORT_HEATMAP_DEFAULT_CELL_SIZE)
  let heatmapMeasureFrame = 0
  let heatmapResizeObserver: ResizeObserver | null = null
  let pendingHeatmapWidth: number | null = null

  const heatmapCells = computed(() =>
    buildReportHeatmapCells(props.activeReport, props.activeHeatmapPoints),
  )
  const heatmapWeekCount = computed(() => Math.ceil(heatmapCells.value.length / 7))
  const heatmapSizingStyle = computed(() => ({
    '--heatmap-cell-size': `${heatmapCellSize.value}px`,
    '--heatmap-cell-gap': `${REPORT_HEATMAP_CELL_GAP}px`,
    '--heatmap-week-count': String(Math.max(heatmapWeekCount.value, 1)),
  }))
  const heatmapMonthLabels = computed(() => buildReportHeatmapMonthLabels(heatmapCells.value))
  const visibleLocationRanking = computed(
    () => props.activeLocationPatterns?.ranking.slice(0, maxPatternItems) ?? [],
  )
  const visibleTimeBuckets = computed(
    () => props.activeTimePatterns?.buckets.slice(0, maxPatternItems) ?? [],
  )

  function getPatternListClass(count: number) {
    if (count === 1) {
      return 'pattern-compact-list--single'
    }

    if (count >= 5) {
      return 'pattern-compact-list--cols-3'
    }

    if (count >= 3) {
      return 'pattern-compact-list--cols-2'
    }

    return 'pattern-compact-list--cols-1'
  }

  function updateHeatmapCellSize(scrollerWidth = heatmapScrollerRef.value?.clientWidth ?? 0) {
    const weekCount = Math.max(heatmapWeekCount.value, 1)

    if (scrollerWidth <= 0) {
      heatmapCellSize.value = REPORT_HEATMAP_DEFAULT_CELL_SIZE
      return
    }

    const totalGap = Math.max(weekCount - 1, 0) * REPORT_HEATMAP_CELL_GAP
    const rawSize = Math.floor((scrollerWidth - totalGap) / weekCount)

    const nextSize = Math.max(
      REPORT_HEATMAP_MIN_CELL_SIZE,
      Math.min(REPORT_HEATMAP_MAX_CELL_SIZE, rawSize),
    )

    if (nextSize !== heatmapCellSize.value) {
      heatmapCellSize.value = nextSize
    }
  }

  function scheduleHeatmapCellSizeUpdate(scrollerWidth?: number) {
    if (typeof scrollerWidth === 'number') {
      pendingHeatmapWidth = scrollerWidth
    }

    if (heatmapMeasureFrame) {
      cancelAnimationFrame(heatmapMeasureFrame)
    }

    heatmapMeasureFrame = window.requestAnimationFrame(() => {
      heatmapMeasureFrame = 0
      updateHeatmapCellSize(pendingHeatmapWidth ?? undefined)
      pendingHeatmapWidth = null
    })
  }

  function stopObservingHeatmapScroller() {
    heatmapResizeObserver?.disconnect()
    heatmapResizeObserver = null
  }

  function startObservingHeatmapScroller() {
    stopObservingHeatmapScroller()

    if (!heatmapScrollerRef.value) {
      return
    }

    scheduleHeatmapCellSizeUpdate(heatmapScrollerRef.value.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    heatmapResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      const nextWidth = Math.round(entry.contentRect.width)

      if (nextWidth > 0) {
        scheduleHeatmapCellSizeUpdate(nextWidth)
      }
    })
    heatmapResizeObserver.observe(heatmapScrollerRef.value)
  }

  onMounted(() => {
    startObservingHeatmapScroller()
  })

  watch(
    [heatmapWeekCount, () => props.activeReport?.reportId],
    async () => {
      await nextTick()
      scheduleHeatmapCellSizeUpdate()
    },
    { flush: 'post' },
  )

  watch(
    heatmapScrollerRef,
    async () => {
      await nextTick()
      startObservingHeatmapScroller()
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    if (heatmapMeasureFrame) {
      cancelAnimationFrame(heatmapMeasureFrame)
    }

    stopObservingHeatmapScroller()
  })

  return {
    DEFAULT_EXPORT_DOCUMENT_WIDTH,
    DEFAULT_EXPORT_IMAGE_SCALE,
    MAX_EXPORT_DOCUMENT_WIDTH,
    MAX_EXPORT_IMAGE_SCALE,
    MIN_EXPORT_DOCUMENT_WIDTH,
    MIN_EXPORT_IMAGE_SCALE,
    activeSummaryGroups,
    canOpenExportDialog,
    canStartExport,
    closeExportDialog,
    exportDialogMessage,
    exportSectionOptions,
    formatPreset: formatReportPreset,
    getMaxWordsInOneDay: getReportMaxWordsInOneDay,
    getPatternCount: getReportPatternCount,
    getPatternListClass,
    getRankingFillWidth: getReportRankingFillWidth,
    getSummaryItemKey: getReportSummaryItemKey,
    buildTimeAnchorTitle: buildReportTimeAnchorTitle,
    handleExportReport,
    heatmapCells,
    heatmapMonthLabels,
    heatmapScrollerRef,
    heatmapSizingStyle,
    heatmapWeekdayLabels,
    isExportDialogVisible,
    isExportSectionAvailable,
    isExportSectionSelected,
    isExporting,
    openExportDialog,
    selectedExportDocumentWidth,
    selectedExportImageScale,
    stepExportDocumentWidth,
    stepExportImageScale,
    toggleExportSection,
    visibleLocationRanking,
    visibleTimeBuckets,
  }
}
