export type ReportPreset = 'month' | 'year' | 'custom'

export const MAX_CUSTOM_REPORT_RANGE_YEARS = 1

export type ReportSectionKey =
  | 'stats'
  | 'heatmap'
  | 'moodTrend'
  | 'tagCloud'
  | 'locationPatterns'
  | 'timePatterns'

export interface ReportPeriod {
  startDate: string
  endDate: string
  label: string
  generatedAt: string
  timezone: string
}

export interface GenerateRangeReportInput {
  workspacePath: string
  preset: ReportPreset
  startDate: string
  endDate: string
  requestedSections: ReportSectionKey[]
  overwriteReportId?: string | null
}

export interface ReportQuery {
  workspacePath: string
  reportId: string
}

export type ReportExportSectionKey =
  | 'cover'
  | 'stats'
  | 'summary'
  | 'heatmap'
  | 'moodTrend'
  | 'tagCloud'
  | 'locationPatterns'
  | 'timePatterns'

export interface ExportRangeReportInput {
  workspacePath: string
  reportId: string
  sections: ReportExportSectionKey[]
  documentWidth?: number
  imageScale?: number
}

export interface ExportRangeReportResult {
  canceled: boolean
  filePaths: string[]
  exportedSections: ReportExportSectionKey[]
  imageCount: number
}

export interface ReportExportPayloadQuery {
  sessionId: string
}

export interface ReportExportReadyInput {
  sessionId: string
  contentHeight: number
}

export interface ReportExportPayload {
  report: RangeReport
  sections: ReportExportSectionKey[]
  documentWidth: number
  imageScale: number
}

export type ReportSummaryTimeAnchorType = 'day' | 'range' | 'multiple' | 'approx'

export interface ReportSummaryTimeAnchor {
  type: ReportSummaryTimeAnchorType
  label: string
  startDate?: string
  endDate?: string
  dates?: string[]
}

export interface ReportSummaryItem {
  text: string
  timeAnchor: ReportSummaryTimeAnchor
}

export interface RangeReportSummary {
  text: string
  progress: ReportSummaryItem[]
  blockers: ReportSummaryItem[]
  memorableMoments: ReportSummaryItem[]
}

export interface ReportSourceSummary {
  totalDays: number
  entryDays: number
  missingDays: number
  totalWords: number
  averageWords: number
  longestStreak: number
}

export interface ReportDailyEntry {
  date: string
  hasEntry: boolean
  wordCount: number
  mood: number | null
  summary: string
  tags: string[]
  location: string
  createdAt: string | null
  updatedAt: string | null
  writingHour: number | null
  insightSource: 'frontmatter' | 'generated' | 'missing'
}

export interface ReportStatsSection {
  recordDays: number
  missingDays: number
  totalWords: number
  averageWords: number
  maxWordsInOneDay: number
  maxWordsDate: string | null
  longestStreak: number
  currentStreakAtEnd: number
}

export interface ReportHeatmapPoint {
  date: string
  value: number
}

export interface ReportMoodPoint {
  date: string
  value: number | null
}

export interface ReportTagCloudItem {
  label: string
  value: number
}

export interface ReportLocationRankingItem {
  name: string
  count: number
}

export interface ReportLocationPatternsSection {
  topLocation: ReportLocationRankingItem | null
  uniqueLocation: ReportLocationRankingItem | null
  ranking: ReportLocationRankingItem[]
}

export interface ReportTimeBucketItem {
  label: string
  count: number
}

export interface ReportTimePatternsSection {
  topTimeBucket: ReportTimeBucketItem | null
  uniqueTimeBucket: ReportTimeBucketItem | null
  buckets: ReportTimeBucketItem[]
}

export interface ReportSections {
  stats?: ReportStatsSection
  heatmap?: {
    points: ReportHeatmapPoint[]
  }
  moodTrend?: {
    points: ReportMoodPoint[]
    averageMood: number | null
  }
  tagCloud?: {
    items: ReportTagCloudItem[]
  }
  locationPatterns?: ReportLocationPatternsSection
  timePatterns?: ReportTimePatternsSection
}

export interface RangeReport {
  reportId: string
  preset: ReportPreset
  period: ReportPeriod
  generation: {
    requestedSections: ReportSectionKey[]
    entryInsightPolicy: 'reuse-only' | 'reuse-or-generate'
    reusedEntryInsightCount: number
    generatedEntryInsightCount: number
    skippedEmptyDays: number
    warnings: string[]
  }
  summary: RangeReportSummary
  source: ReportSourceSummary
  dailyEntries: ReportDailyEntry[]
  sections: ReportSections
}

export interface ReportListItem {
  reportId: string
  preset: ReportPreset
  label: string
  startDate: string
  endDate: string
  generatedAt: string
  summaryText: string
}
