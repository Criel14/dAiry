import { computed } from 'vue'
import {
  buildReportSummaryGroups,
  buildReportTimeAnchorTitle,
  formatReportPreset,
  getReportMaxWordsInOneDay,
  getReportPatternCount,
  getReportRankingFillWidth,
  getReportSummaryItemKey,
} from '../shared/report-view'
import { useReportExportDialog } from './reports-panel-view/useReportExportDialog'
import { useReportHeatmap } from './reports-panel-view/useReportHeatmap'
import type { ReportsPanelProps } from './reports-panel-view/types'
const maxPatternItems = 6

export function useReportsPanelView(props: ReportsPanelProps) {
  const activeSummaryGroups = computed(() => buildReportSummaryGroups(props.activeReport))
  const exportDialog = useReportExportDialog(props)
  const heatmap = useReportHeatmap(props)
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

  return {
    activeSummaryGroups,
    formatPreset: formatReportPreset,
    getMaxWordsInOneDay: getReportMaxWordsInOneDay,
    getPatternCount: getReportPatternCount,
    getPatternListClass,
    getRankingFillWidth: getReportRankingFillWidth,
    getSummaryItemKey: getReportSummaryItemKey,
    buildTimeAnchorTitle: buildReportTimeAnchorTitle,
    visibleLocationRanking,
    visibleTimeBuckets,
    ...exportDialog,
    ...heatmap,
  }
}
