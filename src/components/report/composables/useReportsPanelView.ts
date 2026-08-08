import { computed } from 'vue'
import {
  buildReportLocationPatternView,
  buildReportSummaryGroups,
  buildReportTimeAnchorTitle,
  buildReportTimePatternView,
  formatReportPreset,
  getReportMaxWordsInOneDay,
  getReportSummaryItemKey,
} from '../shared/report-view'
import { useReportExportDialog } from './reports-panel-view/useReportExportDialog'
import type { ReportsPanelProps } from './reports-panel-view/types'

export function useReportsPanelView(props: ReportsPanelProps) {
  const activeSummaryGroups = computed(() => buildReportSummaryGroups(props.activeReport))
  const exportDialog = useReportExportDialog(props)
  const activeLocationPatternView = computed(() =>
    buildReportLocationPatternView(props.activeReport),
  )
  const activeTimePatternView = computed(() => buildReportTimePatternView(props.activeReport))

  return {
    activeSummaryGroups,
    activeLocationPatternView,
    activeTimePatternView,
    formatPreset: formatReportPreset,
    getMaxWordsInOneDay: getReportMaxWordsInOneDay,
    getSummaryItemKey: getReportSummaryItemKey,
    buildTimeAnchorTitle: buildReportTimeAnchorTitle,
    ...exportDialog,
  }
}
