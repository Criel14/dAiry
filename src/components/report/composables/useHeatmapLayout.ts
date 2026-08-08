import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
} from 'vue'
import {
  REPORT_HEATMAP_CELL_GAP,
  REPORT_HEATMAP_DEFAULT_CELL_SIZE,
  REPORT_HEATMAP_MAX_CELL_SIZE,
  REPORT_HEATMAP_MIN_CELL_SIZE,
  REPORT_HEATMAP_WEEKDAY_LABELS,
  buildReportHeatmapMonthLabels,
  type ReportHeatmapCell,
} from '../shared/report-view'

/**
 * 报告热力图自适应布局（展示页与导出文档共用）：
 * 根据 scroller 宽度计算格子尺寸，ResizeObserver 监听变化。
 * maxCellSize 用于导出文档等宽容器场景：放宽上限让热力图随宽度填满，
 * 避免格子触顶后右侧留白。
 */
export function useHeatmapLayout(
  heatmapCells: ComputedRef<ReportHeatmapCell[]>,
  watchKeys: () => unknown[],
  options: { maxCellSize?: number } = {},
) {
  const maxCellSize = options.maxCellSize ?? REPORT_HEATMAP_MAX_CELL_SIZE
  const heatmapWeekdayLabels = REPORT_HEATMAP_WEEKDAY_LABELS
  const heatmapScrollerRef = ref<HTMLElement | null>(null)
  const heatmapCellSize = ref(REPORT_HEATMAP_DEFAULT_CELL_SIZE)
  let heatmapMeasureFrame = 0
  let heatmapResizeObserver: ResizeObserver | null = null
  let pendingHeatmapWidth: number | null = null

  const heatmapWeekCount = computed(() => Math.ceil(heatmapCells.value.length / 7))
  const heatmapSizingStyle = computed(() => ({
    '--heatmap-cell-size': `${heatmapCellSize.value}px`,
    '--heatmap-cell-gap': `${REPORT_HEATMAP_CELL_GAP}px`,
    '--heatmap-week-count': String(Math.max(heatmapWeekCount.value, 1)),
  }))
  const heatmapMonthLabels = computed(() => buildReportHeatmapMonthLabels(heatmapCells.value))

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
      Math.min(maxCellSize, rawSize),
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
    [heatmapWeekCount, watchKeys],
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
    heatmapCells,
    heatmapMonthLabels,
    heatmapScrollerRef,
    heatmapSizingStyle,
    heatmapWeekdayLabels,
  }
}
