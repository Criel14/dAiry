import type {
  RangeReport,
  ReportHeatmapPoint,
  ReportLocationPatternsSection,
  ReportMoodPoint,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../../../types/report'

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
