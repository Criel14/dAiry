import type {
  AiSettingsStatus,
  GenerateDailyInsightsInput,
  GenerateDailyInsightsResult,
  RebuildUserProfileInput,
  RebuildUserProfileResult,
  SaveAiApiKeyInput,
  SaveAiSettingsInput,
  SaveSupplementInput,
  SupplementDocument,
  UserProfileRebuildProgress,
} from './ai'
import type {
  AppTheme,
  AppBootstrap,
  AppConfig,
  DayStartHourPreferenceInput,
  EmailNotificationSecretStatus,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  LaunchOnStartupPreferenceInput,
  NotificationPreferenceInput,
  OpenExternalLinkInput,
  SaveEmailNotificationAuthCodeInput,
  ThemePreferenceInput,
  WindowCloseBehaviorPreferenceInput,
  WindowDirtyStateInput,
  WindowZoomPreferenceInput,
} from './app'
import type {
  JournalEntryBodySaveInput,
  JournalEntryMetadataSaveInput,
  JournalEntryQuery,
  JournalEntryReadResult,
  JournalEntryWriteResult,
  JournalMetaRebuildResult,
  JournalMonthActivityQuery,
  JournalMonthActivityResult,
} from './journal'
import type {
  ExportRangeReportInput,
  ExportRangeReportResult,
  GenerateRangeReportInput,
  RangeReport,
  ReportExportPayload,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
  ReportExportErrorInput,
  ReportListItem,
  ReportQuery,
} from './report'
import type {
  OpenWorkspaceFolderInput,
  WorkspaceSelectionResult,
  WorkspaceStringListInput,
} from './workspace'
import type { TimelineYearData, RebuildTimelineProgress } from './timeline'
import type { McpPreferenceInput, McpRuntimeStatus } from './mcp'
import type { RightPanel } from './ui'
import type {
  Bill,
  BillCategory,
  BillsCategoryQuery,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsExportResult,
  BillsListMonthInput,
  BillsListMonthsInput,
  BillsListYearInput,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsUpdateInput,
} from './bills'

export interface DairyApi {
  getAppBootstrap: () => Promise<AppBootstrap>
  getThemePreference: () => Promise<AppTheme>
  chooseWorkspace: () => Promise<WorkspaceSelectionResult>
  openWorkspaceFolder: (input: OpenWorkspaceFolderInput) => Promise<void>
  readJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  createJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  saveJournalEntryBody: (input: JournalEntryBodySaveInput) => Promise<JournalEntryWriteResult>
  saveJournalEntryMetadata: (
    input: JournalEntryMetadataSaveInput,
  ) => Promise<JournalEntryWriteResult>
  getJournalMonthActivity: (
    input: JournalMonthActivityQuery,
  ) => Promise<JournalMonthActivityResult>
  getJournalYearsWithEntries: (workspacePath: string) => Promise<string[]>
  rebuildJournalMetaIndex: (workspacePath: string) => Promise<JournalMetaRebuildResult>
  generateRangeReport: (input: GenerateRangeReportInput) => Promise<RangeReport>
  getRangeReport: (input: ReportQuery) => Promise<RangeReport>
  listRangeReports: (workspacePath: string) => Promise<ReportListItem[]>
  exportRangeReportPng: (input: ExportRangeReportInput) => Promise<ExportRangeReportResult>
  getReportExportPayload: (input: ReportExportPayloadQuery) => Promise<ReportExportPayload>
  notifyReportExportReady: (input: ReportExportReadyInput) => Promise<void>
  notifyReportExportError: (input: ReportExportErrorInput) => Promise<void>
  getWorkspaceTags: (workspacePath: string) => Promise<string[]>
  getWorkspaceWeatherOptions: (workspacePath: string) => Promise<string[]>
  getWorkspaceLocationOptions: (workspacePath: string) => Promise<string[]>
  setWorkspaceTags: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceWeatherOptions: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceLocationOptions: (input: WorkspaceStringListInput) => Promise<string[]>
  setThemePreference: (input: ThemePreferenceInput) => Promise<AppConfig>
  setWindowZoomFactor: (input: WindowZoomPreferenceInput) => Promise<AppConfig>
  onWindowZoomFactorChanged: (listener: (zoomFactor: number) => void) => () => void
  onNavigateMainPanel: (listener: (panel: RightPanel) => void) => () => void
  setJournalHeatmapEnabled: (input: JournalHeatmapPreferenceInput) => Promise<AppConfig>
  setDayStartHour: (input: DayStartHourPreferenceInput) => Promise<AppConfig>
  setWindowCloseBehavior: (input: WindowCloseBehaviorPreferenceInput) => Promise<AppConfig>
  setLaunchOnStartupPreference: (input: LaunchOnStartupPreferenceInput) => Promise<AppConfig>
  setNotificationPreference: (input: NotificationPreferenceInput) => Promise<AppConfig>
  getEmailNotificationStatus: () => Promise<EmailNotificationSecretStatus>
  saveEmailNotificationAuthCode: (
    input: SaveEmailNotificationAuthCodeInput,
  ) => Promise<EmailNotificationSecretStatus>
  setFrontmatterVisibility: (input: FrontmatterVisibilityInput) => Promise<AppConfig>
  getAiSettingsStatus: () => Promise<AiSettingsStatus>
  saveAiSettings: (input: SaveAiSettingsInput) => Promise<AiSettingsStatus>
  saveAiApiKey: (input: SaveAiApiKeyInput) => Promise<AiSettingsStatus>
  getSupplement: (workspacePath: string) => Promise<SupplementDocument>
  saveSupplement: (input: SaveSupplementInput) => Promise<SupplementDocument>
  generateDailyInsights: (
    input: GenerateDailyInsightsInput,
  ) => Promise<GenerateDailyInsightsResult>
  rebuildUserProfile: (input: RebuildUserProfileInput) => Promise<RebuildUserProfileResult>
  cancelUserProfileRebuild: () => Promise<void>
  onUserProfileRebuildProgress: (
    listener: (progress: UserProfileRebuildProgress) => void,
  ) => () => void
  setWindowDirtyState: (input: WindowDirtyStateInput) => Promise<void>
  setMcpPreference: (input: McpPreferenceInput) => Promise<AppConfig>
  getMcpRuntimeStatus: () => Promise<McpRuntimeStatus>
  openExternalLink: (input: OpenExternalLinkInput) => Promise<void>
  openDevTools: () => Promise<void>
  getTimeline: (input: { workspacePath: string; year: number }) => Promise<TimelineYearData | null>
  rebuildTimeline: (input: {
    workspacePath: string
    year: number
  }) => Promise<{ skipped: boolean }>
  cancelTimelineRebuild: () => Promise<void>
  onTimelineRebuildProgress: (
    listener: (progress: RebuildTimelineProgress) => void,
  ) => () => void
  listBillsByMonth: (input: BillsListMonthInput) => Promise<Bill[]>
  listBillsByYear: (input: BillsListYearInput) => Promise<Bill[]>
  listBillsYears: (input: BillsCategoryQuery) => Promise<string[]>
  listBillsMonths: (input: BillsListMonthsInput) => Promise<string[]>
  createBill: (input: BillsRecordInput) => Promise<Bill>
  updateBill: (input: BillsUpdateInput) => Promise<Bill>
  deleteBill: (input: BillsDeleteInput) => Promise<void>
  getBillCategories: (input: BillsCategoryQuery) => Promise<BillCategory[]>
  createBillCategory: (input: BillsCreateCategoryInput) => Promise<BillCategory[]>
  renameBillCategory: (input: BillsRenameCategoryInput) => Promise<BillCategory[]>
  deleteBillCategory: (input: BillsDeleteCategoryInput) => Promise<BillCategory[]>
  exportBillsExcel: (input: BillsCategoryQuery) => Promise<BillsExportResult>
}
