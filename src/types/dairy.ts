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
    journalHeatmapEnabled: boolean
    dayStartHour: number
    frontmatterVisibility: FrontmatterVisibilityConfig
  }
  ai: AiSettings
}

export interface FrontmatterVisibilityConfig {
  weather: boolean
  location: boolean
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

export interface JournalHeatmapPreferenceInput {
  enabled: boolean
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
  existingTags: string[]
  newTags: string[]
}

export interface WindowDirtyStateInput {
  isDirty: boolean
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
  getWorkspaceTags: (workspacePath: string) => Promise<string[]>
  getWorkspaceWeatherOptions: (workspacePath: string) => Promise<string[]>
  getWorkspaceLocationOptions: (workspacePath: string) => Promise<string[]>
  setWorkspaceTags: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceWeatherOptions: (input: WorkspaceStringListInput) => Promise<string[]>
  setWorkspaceLocationOptions: (input: WorkspaceStringListInput) => Promise<string[]>
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
}
