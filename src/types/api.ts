import type {
  AiContextDocument,
  AiSettingsStatus,
  GenerateDailyInsightsInput,
  GenerateDailyInsightsResult,
  SaveAiApiKeyInput,
  SaveAiContextInput,
  SaveAiSettingsInput,
} from './ai'
import type {
  AppTheme,
  AppBootstrap,
  AppConfig,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  OpenExternalLinkInput,
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
  ReportListItem,
  ReportQuery,
} from './report'
import type {
  OpenWorkspaceFolderInput,
  WorkspaceSelectionResult,
  WorkspaceStringListInput,
} from './workspace'
import type { RightPanel } from './ui'

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
  setThemePreference: (input: ThemePreferenceInput) => Promise<AppConfig>
  setWindowZoomFactor: (input: WindowZoomPreferenceInput) => Promise<AppConfig>
  onWindowZoomFactorChanged: (listener: (zoomFactor: number) => void) => () => void
  onNavigateMainPanel: (listener: (panel: RightPanel) => void) => () => void
  setJournalHeatmapEnabled: (input: JournalHeatmapPreferenceInput) => Promise<AppConfig>
  setDayStartHour: (input: DayStartHourPreferenceInput) => Promise<AppConfig>
  setWindowCloseBehavior: (input: WindowCloseBehaviorPreferenceInput) => Promise<AppConfig>
  setFrontmatterVisibility: (input: FrontmatterVisibilityInput) => Promise<AppConfig>
  getAiSettingsStatus: () => Promise<AiSettingsStatus>
  saveAiSettings: (input: SaveAiSettingsInput) => Promise<AiSettingsStatus>
  saveAiApiKey: (input: SaveAiApiKeyInput) => Promise<AiSettingsStatus>
  getAiContext: () => Promise<AiContextDocument>
  saveAiContext: (input: SaveAiContextInput) => Promise<AiContextDocument>
  generateDailyInsights: (
    input: GenerateDailyInsightsInput,
  ) => Promise<GenerateDailyInsightsResult>
  setWindowDirtyState: (input: WindowDirtyStateInput) => Promise<void>
  openExternalLink: (input: OpenExternalLinkInput) => Promise<void>
  openDevTools: () => Promise<void>
}
