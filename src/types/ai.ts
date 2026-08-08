export type AiProviderType = 'openai' | 'deepseek' | 'alibaba' | 'openai-compatible' | 'claude' | 'kimi' | 'zhipu'

export interface AiSettings {
  providerType: AiProviderType
  baseURL: string
  model: string
  timeoutMs: number
  dailyContextDays: number
  profileRefreshIntervalDays: number
}

export interface AiSettingsStatus {
  settings: AiSettings
  hasApiKey: boolean
  isConfigured: boolean
}

export interface SupplementDocument {
  content: string
}

export interface SaveAiSettingsInput {
  providerType: AiProviderType
  baseURL: string
  model: string
  timeoutMs: number
  dailyContextDays: number
  profileRefreshIntervalDays: number
}

export interface SaveAiApiKeyInput {
  providerType: AiProviderType
  apiKey: string
}

export interface SaveSupplementInput {
  workspacePath: string
  content: string
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

export interface RecentDaySummary {
  date: string
  summary: string
  tags: string[]
  mood: number
}

export interface RebuildUserProfileInput {
  workspacePath: string
}

export interface RebuildUserProfileResult {
  status: 'completed' | 'cancelled'
  processedMonths: number
  totalMonths: number
}

export interface UserProfileRebuildProgress {
  month: string
  index: number
  total: number
}
