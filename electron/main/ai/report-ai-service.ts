import type { RangeReport, RangeReportSummary } from '../../../src/types/dairy'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { readAiApiKey } from '../ai-secrets'
import { createAiChatClient } from './provider-factory'
import { loadPrompt } from './prompt-loader'

interface RangeReportSummaryPayload {
  text?: unknown
  themes?: unknown
  progress?: unknown
  blockers?: unknown
  memorableMoments?: unknown
}

function extractJsonObject(text: string) {
  const trimmedText = text.trim()

  try {
    return JSON.parse(trimmedText) as RangeReportSummaryPayload
  } catch {
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }

    return JSON.parse(jsonMatch[0]) as RangeReportSummaryPayload
  }
}

function normalizeStringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) {
    return []
  }

  const uniqueItems = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const normalizedItem = item.trim()
    if (!normalizedItem) {
      continue
    }

    uniqueItems.add(normalizedItem)
  }

  return [...uniqueItems].slice(0, maxLength)
}

function normalizeSummaryPayload(payload: RangeReportSummaryPayload): RangeReportSummary {
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    throw new Error('大模型返回的区间总结为空。')
  }

  return {
    text,
    themes: normalizeStringArray(payload.themes, 5),
    progress: normalizeStringArray(payload.progress, 4),
    blockers: normalizeStringArray(payload.blockers, 4),
    memorableMoments: normalizeStringArray(payload.memorableMoments, 4),
  }
}

function ensureAiSettingsReady(config: Awaited<ReturnType<typeof readAppConfig>>) {
  const settings = normalizeAiSettings(config.ai)

  if (!settings.baseURL || !settings.model) {
    throw new Error('请先完成区间总结所需的大模型配置。')
  }

  return settings
}

function buildSummaryPrompt(report: RangeReport) {
  const topTags = report.sections.tagCloud?.items.slice(0, 12) ?? []
  const highlights = report.sections.highlights?.events.slice(0, 6) ?? []
  const locations = report.sections.locationPatterns?.ranking.slice(0, 6) ?? []
  const timeBuckets = report.sections.timePatterns?.buckets ?? []
  const summarizedEntries = report.dailyEntries
    .filter((entry) => entry.hasEntry && (entry.summary.trim() || entry.tags.length > 0))
    .slice(0, 12)
    .map((entry) => ({
      date: entry.date,
      summary: entry.summary,
      tags: entry.tags,
      mood: entry.mood,
      wordCount: entry.wordCount,
      location: entry.location,
    }))

  return JSON.stringify(
    {
      period: report.period,
      source: report.source,
      generation: {
        requestedSections: report.generation.requestedSections,
        warnings: report.generation.warnings,
      },
      facts: {
        topTags,
        highlights,
        locations,
        timeBuckets,
        summarizedEntries,
      },
    },
    null,
    2,
  )
}

export async function generateRangeReportSummaryWithAi(report: RangeReport) {
  const [config, systemPrompt] = await Promise.all([
    readAppConfig(),
    loadPrompt('rangeReportSummarySystem'),
  ])
  const settings = ensureAiSettingsReady(config)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先保存当前 provider 的 API Key。')
  }

  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildSummaryPrompt(report),
      },
    ],
  })

  return normalizeSummaryPayload(extractJsonObject(responseText))
}
