import type { AiSettingsStatus, SaveAiSettingsInput } from '../../src/types/dairy'
import { readAppConfig, setAiSettings } from './app-config'
import { hasAiApiKey } from './ai-secrets'

export async function getAiSettingsStatus(): Promise<AiSettingsStatus> {
  const config = await readAppConfig()
  const hasApiKey = await hasAiApiKey(config.ai.providerType)

  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey),
  }
}

export async function saveAiSettings(input: SaveAiSettingsInput): Promise<AiSettingsStatus> {
  const config = await setAiSettings(input)
  const hasApiKey = await hasAiApiKey(config.ai.providerType)

  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey),
  }
}
