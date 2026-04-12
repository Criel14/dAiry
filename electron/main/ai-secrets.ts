import path from 'node:path'
import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type {
  AiProviderType,
  AiSettingsStatus,
  SaveAiApiKeyInput,
} from '../../src/types/dairy'
import { readAppConfig } from './app-config'

interface SecretsFile {
  ai?: {
    providerType?: AiProviderType
    encryptedApiKey?: string
  }
}

function getSecretsFilePath() {
  return path.join(app.getPath('userData'), 'secrets.json')
}

function normalizeSecretsFile(rawValue: unknown): SecretsFile {
  if (!rawValue || typeof rawValue !== 'object') {
    return {}
  }

  const value = rawValue as SecretsFile
  const providerType =
    value.ai?.providerType === 'openai' ||
    value.ai?.providerType === 'deepseek' ||
    value.ai?.providerType === 'alibaba' ||
    value.ai?.providerType === 'openai-compatible'
      ? value.ai.providerType
      : undefined

  const encryptedApiKey =
    typeof value.ai?.encryptedApiKey === 'string' ? value.ai.encryptedApiKey : undefined

  return {
    ai:
      providerType || encryptedApiKey
        ? {
            providerType,
            encryptedApiKey,
          }
        : undefined,
  }
}

async function readSecretsFile(): Promise<SecretsFile> {
  try {
    const fileContent = await readFile(getSecretsFilePath(), 'utf-8')
    return normalizeSecretsFile(JSON.parse(fileContent))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

async function writeSecretsFile(data: SecretsFile) {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getSecretsFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

function ensureSafeStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统环境暂不支持安全加密存储 API Key。')
  }
}

export async function hasAiApiKey(providerType: AiProviderType) {
  const secrets = await readSecretsFile()

  return Boolean(
    secrets.ai?.providerType === providerType &&
      typeof secrets.ai.encryptedApiKey === 'string' &&
      secrets.ai.encryptedApiKey.trim(),
  )
}

export async function readAiApiKey(providerType: AiProviderType) {
  const secrets = await readSecretsFile()

  if (
    secrets.ai?.providerType !== providerType ||
    !secrets.ai.encryptedApiKey ||
    !secrets.ai.encryptedApiKey.trim()
  ) {
    return null
  }

  ensureSafeStorageAvailable()

  try {
    return safeStorage.decryptString(Buffer.from(secrets.ai.encryptedApiKey, 'base64'))
  } catch {
    throw new Error('读取大模型 API Key 失败，密钥可能已损坏，请重新保存。')
  }
}

export async function saveAiApiKey(input: SaveAiApiKeyInput): Promise<AiSettingsStatus> {
  const apiKey = input.apiKey.trim()

  if (apiKey) {
    ensureSafeStorageAvailable()

    await writeSecretsFile({
      ai: {
        providerType: input.providerType,
        encryptedApiKey: safeStorage.encryptString(apiKey).toString('base64'),
      },
    })
  } else {
    await writeSecretsFile({
      ai: {
        providerType: input.providerType,
      },
    })
  }

  const config = await readAppConfig()
  const hasApiKey = await hasAiApiKey(config.ai.providerType)

  return {
    settings: config.ai,
    hasApiKey,
    isConfigured: Boolean(config.ai.baseURL && config.ai.model && hasApiKey),
  }
}
