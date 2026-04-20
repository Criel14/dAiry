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

export interface AiContextDocument {
  content: string
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

export interface SaveAiContextInput {
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
