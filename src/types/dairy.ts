export type AiProviderType = 'openai' | 'deepseek' | 'alibaba' | 'openai-compatible'

export interface AiSettings {
  providerType: AiProviderType
  baseURL: string
  model: string
  timeoutMs: number
}

export interface AiSettingsStatus {
  settings: AiSettings
  hasApiKey: boolean
  isConfigured: boolean
}

export interface AppConfig {
  lastOpenedWorkspace: string | null
  recentWorkspaces: string[]
  ui: {
    theme: 'system' | 'light' | 'dark'
    zoomFactor: number
    journalHeatmapEnabled: boolean
    dayStartHour: number
    frontmatterVisibility: FrontmatterVisibilityConfig
  }
  ai: AiSettings
}

export interface FrontmatterVisibilityConfig {
  weather: boolean
  location: boolean
  mood: boolean
  summary: boolean
  tags: boolean
}

export interface AppBootstrap {
  config: AppConfig
}

export interface WorkspaceSelectionResult {
  canceled: boolean
  workspacePath: string | null
  config: AppConfig
}

export interface JournalEntryQuery {
  workspacePath: string
  date: string
}

export interface JournalEntryMetadata {
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
}

export interface JournalFrontmatter extends JournalEntryMetadata {
  createdAt: string
  updatedAt: string
}

export interface JournalEntryReadResult {
  status: 'ready' | 'missing'
  filePath: string
  frontmatter: JournalFrontmatter | null
  body: string | null
}

export interface JournalEntryWriteResult {
  filePath: string
  savedAt: string
}

export interface JournalEntryBodySaveInput extends JournalEntryQuery {
  body: string
}

export interface JournalEntryMetadataSaveInput extends JournalEntryQuery {
  metadata: JournalEntryMetadata
}

export interface JournalMonthActivityQuery {
  workspacePath: string
  month: string
}

export interface JournalDayActivity {
  date: string
  hasEntry: boolean
  wordCount: number
}

export interface JournalMonthActivityResult {
  month: string
  days: JournalDayActivity[]
}

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

export interface JournalHeatmapPreferenceInput {
  enabled: boolean
}

export interface WindowZoomPreferenceInput {
  zoomFactor: number
}

export interface FrontmatterVisibilityInput {
  visibility: FrontmatterVisibilityConfig
}

export interface DayStartHourPreferenceInput {
  hour: number
}

export interface WorkspaceStringListInput {
  workspacePath: string
  items: string[]
}

export interface SaveAiSettingsInput {
  providerType: AiProviderType
  baseURL: string
  model: string
  timeoutMs: number
}

export interface SaveAiApiKeyInput {
  providerType: AiProviderType
  apiKey: string
}

export interface GenerateDailyInsightsInput {
  workspacePath: string
  date: string
  body: string
  workspaceTags: string[]
}

export interface GenerateDailyInsightsResult {
  summary: string
  tags: string[]
  mood: number
  existingTags: string[]
  newTags: string[]
}

export interface WindowDirtyStateInput {
  isDirty: boolean
}

export interface OpenExternalLinkInput {
  url: string
}

export interface DairyApi {
  getAppBootstrap: () => Promise<AppBootstrap>
  chooseWorkspace: () => Promise<WorkspaceSelectionResult>
  readJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  createJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  saveJournalEntryBody: (input: JournalEntryBodySaveInput) => Promise<JournalEntryWriteResult>
  saveJournalEntryMetadata: (
    input: JournalEntryMetadataSaveInput,
  ) => Promise<JournalEntryWriteResult>
  getJournalMonthActivity: (
    input: JournalMonthActivityQuery,
  ) => Promise<JournalMonthActivityResult>
  generateRangeReport: (input: GenerateRangeReportInput) => Promise<RangeReport>
  getRangeReport: (input: ReportQuery) => Promise<RangeReport>
  listRangeReports: (workspacePath: string) => Promise<ReportListItem[]>
  exportRangeReportPng: (input: ExportRangeReportInput) => Promise<ExportRangeReportResult>
  getReportExportPayload: (input: ReportExportPayloadQuery) => Promise<ReportExportPayload>
  notifyReportExportReady: (input: ReportExportReadyInput) => Promise<void>
  getWorkspaceTags: (workspacePath: string) => Promise<string[]>
  getWorkspaceWeatherOptions: (workspacePath: string) => Promise<string[]>
  getWorkspaceLocationOptions: (workspacePath: string) => Promise<string[]>
  setWorkspaceTags: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceWeatherOptions: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceLocationOptions: (input: WorkspaceStringListInput) => Promise<string[]>
  setWindowZoomFactor: (input: WindowZoomPreferenceInput) => Promise<AppConfig>
  onWindowZoomFactorChanged: (listener: (zoomFactor: number) => void) => () => void
  setJournalHeatmapEnabled: (input: JournalHeatmapPreferenceInput) => Promise<AppConfig>
  setDayStartHour: (input: DayStartHourPreferenceInput) => Promise<AppConfig>
  setFrontmatterVisibility: (input: FrontmatterVisibilityInput) => Promise<AppConfig>
  getAiSettingsStatus: () => Promise<AiSettingsStatus>
  saveAiSettings: (input: SaveAiSettingsInput) => Promise<AiSettingsStatus>
  saveAiApiKey: (input: SaveAiApiKeyInput) => Promise<AiSettingsStatus>
  generateDailyInsights: (
    input: GenerateDailyInsightsInput,
  ) => Promise<GenerateDailyInsightsResult>
  setWindowDirtyState: (input: WindowDirtyStateInput) => Promise<void>
  openExternalLink: (input: OpenExternalLinkInput) => Promise<void>
  openDevTools: () => Promise<void>
}
