import type {
  GenerateDailyInsightsInput,
  GenerateDailyInsightsResult,
} from '../../../src/types/dairy'
import { normalizeAiSettings } from '../app-config'
import { assertValidDate } from '../workspace-paths'
import { readAppConfig } from '../app-config'
import { readAiApiKey } from '../ai-secrets'
import { normalizeStringList } from '../journal-document'
import { createAiChatClient } from './provider-factory'
import { loadPrompt } from './prompt-loader'

interface DailyInsightsPayload {
  summary?: unknown
  tags?: unknown
}

interface EnsureDailyInsightsInput extends GenerateDailyInsightsInput {
  currentSummary?: string
  currentTags?: string[]
}

function extractJsonObject(text: string) {
  const trimmedText = text.trim()

  try {
    return JSON.parse(trimmedText) as DailyInsightsPayload
  } catch {
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }

    return JSON.parse(jsonMatch[0]) as DailyInsightsPayload
  }
}

function createWorkspaceTagMap(workspaceTags: string[]) {
  const tagMap = new Map<string, string>()

  for (const tag of normalizeStringList(workspaceTags)) {
    tagMap.set(tag.toLocaleLowerCase(), tag)
  }

  return tagMap
}

function normalizeDailyInsights(
  payload: DailyInsightsPayload,
  workspaceTags: string[],
): GenerateDailyInsightsResult {
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : ''
  if (!summary) {
    throw new Error('大模型返回的总结为空，请稍后重试。')
  }

  const workspaceTagMap = createWorkspaceTagMap(workspaceTags)
  const normalizedTags = normalizeStringList(Array.isArray(payload.tags) ? payload.tags : []).map(
    (tag) => workspaceTagMap.get(tag.toLocaleLowerCase()) ?? tag,
  )

  const dedupedTags = [...new Set(normalizedTags)].slice(0, 8)
  if (dedupedTags.length < 3) {
    throw new Error('大模型返回的标签数量不足，暂时无法完成自动整理。')
  }

  const existingTags = dedupedTags.filter((tag) => workspaceTagMap.has(tag.toLocaleLowerCase()))
  const newTags = dedupedTags.filter((tag) => !workspaceTagMap.has(tag.toLocaleLowerCase()))

  return {
    summary,
    tags: dedupedTags,
    existingTags,
    newTags,
  }
}

function buildDailyInsightsPrompt(input: GenerateDailyInsightsInput) {
  const body = input.body.trim()
  if (!body) {
    throw new Error('正文为空，暂时无法自动整理。')
  }

  const workspaceTags =
    input.workspaceTags.length > 0 ? input.workspaceTags.join('、') : '当前工作区还没有既有标签'

  return [
    `业务日期：${input.date}`,
    `当前工作区已有标签：${workspaceTags}`,
    '当日日记正文：',
    body,
  ].join('\n\n')
}

function ensureAiSettingsReady(config: Awaited<ReturnType<typeof readAppConfig>>) {
  const settings = normalizeAiSettings(config.ai)

  if (!settings.baseURL) {
    throw new Error('请先在设置页填写大模型接口地址。')
  }

  if (!settings.model) {
    throw new Error('请先在设置页填写大模型模型名称。')
  }

  return settings
}

export async function generateDailyInsights(
  input: GenerateDailyInsightsInput,
): Promise<GenerateDailyInsightsResult> {
  assertValidDate(input.date)

  if (!input.workspacePath.trim()) {
    throw new Error('当前还没有可用的工作区。')
  }

  if (!input.body.trim()) {
    throw new Error('正文为空，暂时无法自动整理。')
  }

  const [config, systemPrompt] = await Promise.all([readAppConfig(), loadPrompt('dailyOrganizeSystem')])
  const settings = ensureAiSettingsReady(config)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildDailyInsightsPrompt(input) },
    ],
  })

  return normalizeDailyInsights(extractJsonObject(responseText), input.workspaceTags)
}

export async function ensureDailyInsights(
  input: EnsureDailyInsightsInput,
): Promise<GenerateDailyInsightsResult> {
  const currentSummary = input.currentSummary?.trim() ?? ''
  const currentTags = normalizeStringList(input.currentTags ?? [])

  if (currentSummary && currentTags.length >= 3) {
    return normalizeDailyInsights(
      {
        summary: currentSummary,
        tags: currentTags,
      },
      input.workspaceTags,
    )
  }

  return generateDailyInsights(input)
}
