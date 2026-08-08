import { computed } from 'vue'
import type { RangeReport, ReportExportSectionKey } from '../../../../types/report'
import {
  buildReportLocationPatternView,
  buildReportSummaryGroups,
  buildReportTimeAnchorTitle,
  buildReportTimePatternView,
  formatReportPreset,
  getReportMaxWordsInOneDay,
  getReportSummaryItemKey,
} from '../../shared/report-view'

interface ReportExportDocumentProps {
  report: RangeReport
  sections: ReportExportSectionKey[]
  documentWidth?: number
}

export function useReportExportDocument(props: ReportExportDocumentProps) {
  const sectionSet = computed(() => new Set(props.sections))
  const summaryGroups = computed(() => buildReportSummaryGroups(props.report))
  const locationPatternView = computed(() => buildReportLocationPatternView(props.report))
  const timePatternView = computed(() => buildReportTimePatternView(props.report))
  const maxWordsInOneDay = computed(() => getReportMaxWordsInOneDay(props.report))

  function shouldShowSection(sectionKey: ReportExportSectionKey) {
    return sectionSet.value.has(sectionKey)
  }

  return {
    buildTimeAnchorTitle: buildReportTimeAnchorTitle,
    formatPreset: formatReportPreset,
    getSummaryItemKey: getReportSummaryItemKey,
    locationPatternView,
    maxWordsInOneDay,
    shouldShowSection,
    summaryGroups,
    timePatternView,
  }
}
