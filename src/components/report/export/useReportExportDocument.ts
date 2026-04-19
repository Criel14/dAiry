import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RangeReport, ReportExportSectionKey } from '../../../types/dairy'
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

interface ReportExportDocumentProps {
  report: RangeReport
  sections: ReportExportSectionKey[]
  documentWidth?: number
}

const maxPatternItems = 6

export function useReportExportDocument(props: ReportExportDocumentProps) {
  const heatmapScrollerRef = ref<HTMLElement | null>(null)
  const heatmapCellSize = ref(REPORT_HEATMAP_DEFAULT_CELL_SIZE)
  let heatmapMeasureFrame = 0
  let heatmapResizeObserver: ResizeObserver | null = null
  let pendingHeatmapWidth: number | null = null

  const sectionSet = computed(() => new Set(props.sections))
  const summaryGroups = computed(() => buildReportSummaryGroups(props.report))
  const visibleLocationRanking = computed(
    () => props.report.sections.locationPatterns?.ranking.slice(0, maxPatternItems) ?? [],
  )
  const visibleTimeBuckets = computed(
    () => props.report.sections.timePatterns?.buckets.slice(0, maxPatternItems) ?? [],
  )
  const heatmapCells = computed(() =>
    buildReportHeatmapCells(props.report, props.report.sections.heatmap?.points ?? []),
  )
  const heatmapWeekCount = computed(() => Math.ceil(heatmapCells.value.length / 7))
  const heatmapWeekdayLabels = REPORT_HEATMAP_WEEKDAY_LABELS
  const heatmapSizingStyle = computed(() => ({
    '--heatmap-cell-size': `${heatmapCellSize.value}px`,
    '--heatmap-cell-gap': `${REPORT_HEATMAP_CELL_GAP}px`,
    '--heatmap-week-count': String(Math.max(heatmapWeekCount.value, 1)),
  }))
  const heatmapMonthLabels = computed(() => buildReportHeatmapMonthLabels(heatmapCells.value))
  const maxWordsInOneDay = computed(() => getReportMaxWordsInOneDay(props.report))

  function shouldShowSection(sectionKey: ReportExportSectionKey) {
    return sectionSet.value.has(sectionKey)
  }

  function getPatternListClass(count: number) {
    if (count >= 5) {
      return 'pattern-list--cols-3'
    }

    if (count >= 3) {
      return 'pattern-list--cols-2'
    }

    return 'pattern-list--cols-1'
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
    [heatmapWeekCount, () => props.report.reportId, () => props.documentWidth],
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
    buildTimeAnchorTitle: buildReportTimeAnchorTitle,
    formatPreset: formatReportPreset,
    getPatternCount: getReportPatternCount,
    getPatternListClass,
    getRankingFillWidth: (value: number, maxValue: number) =>
      getReportRankingFillWidth(value, maxValue, 16),
    getSummaryItemKey: getReportSummaryItemKey,
    heatmapCells,
    heatmapMonthLabels,
    heatmapScrollerRef,
    heatmapSizingStyle,
    heatmapWeekdayLabels,
    maxWordsInOneDay,
    shouldShowSection,
    summaryGroups,
    visibleLocationRanking,
    visibleTimeBuckets,
  }
}
