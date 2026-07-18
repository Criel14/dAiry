import dayjs from 'dayjs'
import type {
  GenerateDailyInsightsInput,
  GenerateDailyInsightsResult,
  RecentDaySummary,
} from '../../../src/types/ai'
import { normalizeAiSettings } from '../app-config'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { readAppConfig } from '../app-config'
import { readAiContext } from './context'
import { readAiApiKey } from '../secrets'
import { normalizeStringList, readJournalDocument } from '../journal/document'
import { createAiChatClient } from './provider-factory'
import { loadPrompt } from './prompt-loader'

interface DailyInsightsPayload {
  summary?: unknown
  tags?: unknown
  mood?: unknown
}

interface EnsureDailyInsightsInput extends GenerateDailyInsightsInput {
  currentSummary?: string
  currentTags?: string[]
  currentMood?: number
}

interface DailyInsightsPromptInput extends GenerateDailyInsightsInput {
  aiContext: string
  recentSummaries: RecentDaySummary[]
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
  const mood = normalizeMood(payload.mood)

  return {
    summary,
    tags: dedupedTags,
    mood,
    existingTags,
    newTags,
  }
}

function normalizeMood(value: unknown): number {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('大模型返回的心情分数格式无效，请稍后重试。')
  }

  if (value < -5 || value > 5) {
    throw new Error('大模型返回的心情分数超出范围，请稍后重试。')
  }

  return value
}

function buildDailyInsightsPrompt(input: DailyInsightsPromptInput) {
  const body = input.body.trim()
  if (!body) {
    throw new Error('正文为空，暂时无法自动整理。')
  }

  const workspaceTags =
    input.workspaceTags.length > 0 ? input.workspaceTags.join('、') : '当前工作区还没有既有标签'

  return [
    `业务日期：${input.date}`,
    `当前工作区已有标签：${workspaceTags}`,
    buildRecentSummariesBlock(input.recentSummaries),
    buildAiContextPromptBlock(input.aiContext),
    '当日日记正文：',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildAiContextPromptBlock(aiContext: string) {
  const normalizedContext = aiContext.trim()
  if (!normalizedContext) {
    return ''
  }

  return [
    '你在整理和总结时，可以参考以下补充知识。',
    '这些内容用于帮助你理解用户的长期背景、固定术语和偏好；如果与当天日记事实冲突，以当天日记为准。',
    normalizedContext,
  ].join('\n')
}

export async function getRecentDailySummaries(
  workspacePath: string,
  date: string,
  days: number,
): Promise<RecentDaySummary[]> {
  assertValidDate(date)
  const summaries: RecentDaySummary[] = []

  for (let offset = days; offset >= 1; offset -= 1) {
    const targetDate = dayjs(date).subtract(offset, 'day').format('YYYY-MM-DD')

    try {
      const document = await readJournalDocument(
        resolveJournalEntryFilePath(workspacePath, targetDate),
      )
      const { summary, tags, mood } = document.frontmatter

      if (!summary.trim() && tags.length === 0) {
        continue
      }

      summaries.push({
        date: targetDate,
        summary: summary.trim(),
        tags,
        mood,
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      throw error
    }
  }

  return summaries
}

function buildRecentSummariesBlock(recentSummaries: RecentDaySummary[]) {
  if (recentSummaries.length === 0) {
    return ''
  }

  const summaryLines = recentSummaries.map((item) => {
    const parts = [
      `摘要: ${item.summary || '（无）'}`,
      `心情: ${item.mood}`,
    ]

    if (item.tags.length > 0) {
      parts.push(`标签: ${item.tags.join('、')}`)
    }

    return `- ${item.date}: ${parts.join('  |  ')}`
  })

  return [
    '以下是最近几天的日记摘要，仅用于帮助你理解近期上下文；总结、标签与心情仍必须以当日正文为准。',
    ...summaryLines,
  ].join('\n')
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

  const [config, systemPrompt, aiContext] = await Promise.all([
    readAppConfig(),
    loadPrompt('dailyOrganizeSystem'),
    readAiContext(),
  ])
  const settings = ensureAiSettingsReady(config)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  const recentSummaries = await getRecentDailySummaries(
    input.workspacePath,
    input.date,
    settings.dailyContextDays,
  )

  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildDailyInsightsPrompt({ ...input, aiContext, recentSummaries }) },
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
        mood: input.currentMood,
      },
      input.workspaceTags,
    )
  }

  return generateDailyInsights(input)
}
