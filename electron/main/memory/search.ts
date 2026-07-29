import { readAppConfig } from '../app-config'
import { readAiApiKey } from '../secrets'
import { createAiChatClient, ensureAiSettingsReady, loadPrompt } from '../ai'
import type { AiChatClient } from '../ai'
import { batchReadEntries, listJournalYears, readMetaCandidates, uniqDates } from './retrieval'
import type {
  MemoryEntryDocument,
  MemoryMetaCandidate,
  MemorySearchInput,
  MemorySearchResult,
} from './types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_DISPLAY_LIMIT = 10
const MAX_DISPLAY_LIMIT = 20
const FILTER_CHUNK_SIZE = 200
const RERANK_CHUNK_SIZE = 5
const RERANK_MIN_SCORE = 60
const MAX_BODY_CHARS_FOR_RERANK = 1800
const MAX_BODY_CHARS_FOR_SUMMARY = 10000

type MemoryConfidence = MemorySearchResult['confidence']

interface FilterPayload {
  dates?: unknown
}

interface RerankPayload {
  results?: unknown
}

interface RerankItem {
  date: string
  score: number
  reason: string
}

interface SummarizePayload {
  answer?: unknown
  findings?: unknown
  confidence?: unknown
}

export function splitIntoChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function extractJsonObject<T>(text: string): T {
  const trimmedText = text.trim()

  try {
    return JSON.parse(trimmedText) as T
  } catch {
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }

    return JSON.parse(jsonMatch[0]) as T
  }
}

function createEmptyResult(query: string, answer: string): MemorySearchResult {
  return {
    query,
    answer,
    findings: [],
    relatedDates: [],
    displayedCount: 0,
    totalCount: 0,
    confidence: 'low',
  }
}

function normalizeYears(years: string[] | undefined): string[] | null {
  if (!Array.isArray(years) || years.length === 0) {
    return null
  }

  const normalizedYears = [...new Set(years)]
    .map((year) => (typeof year === 'string' ? year.trim() : ''))
    .filter((year) => /^\d{4}$/.test(year))
    .sort()

  return normalizedYears.length > 0 ? normalizedYears : null
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_DISPLAY_LIMIT
  }

  return Math.min(limit, MAX_DISPLAY_LIMIT)
}

function buildCandidateLine(candidate: MemoryMetaCandidate) {
  const parts = [`摘要: ${candidate.summary || '（无）'}`, `心情: ${candidate.mood}`]

  if (candidate.tags.length > 0) {
    parts.push(`标签: ${candidate.tags.join('、')}`)
  }

  if (candidate.location) {
    parts.push(`地点: ${candidate.location}`)
  }

  return `- ${candidate.date}: ${parts.join('  |  ')}`
}

async function filterCandidateDates(
  client: AiChatClient,
  systemPrompt: string,
  query: string,
  candidates: MemoryMetaCandidate[],
): Promise<string[]> {
  const userPrompt = [
    `用户查询：${query}`,
    '候选日记元信息（每行一篇）：',
    ...candidates.map(buildCandidateLine),
  ].join('\n')

  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const payload = extractJsonObject<FilterPayload>(responseText)
  if (!Array.isArray(payload.dates)) {
    return []
  }

  return payload.dates.filter(
    (date): date is string => typeof date === 'string' && DATE_PATTERN.test(date.trim()),
  )
}

function buildRerankEntryBlock(entry: MemoryEntryDocument) {
  const truncatedBody =
    entry.body.length > MAX_BODY_CHARS_FOR_RERANK
      ? `${entry.body.slice(0, MAX_BODY_CHARS_FOR_RERANK)}\n……（正文过长，已截断）`
      : entry.body

  return [`### ${entry.date}`, `摘要: ${entry.summary || '（无）'}`, '正文:', truncatedBody].join(
    '\n',
  )
}

async function rerankEntries(
  client: AiChatClient,
  systemPrompt: string,
  query: string,
  entries: MemoryEntryDocument[],
): Promise<RerankItem[]> {
  const userPrompt = [
    `用户查询：${query}`,
    '待评估日记：',
    entries.map(buildRerankEntryBlock).join('\n\n'),
  ].join('\n\n')

  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const payload = extractJsonObject<RerankPayload>(responseText)
  if (!Array.isArray(payload.results)) {
    return []
  }

  const items: RerankItem[] = []
  for (const rawItem of payload.results) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue
    }

    const item = rawItem as { date?: unknown; score?: unknown; reason?: unknown }
    if (typeof item.date !== 'string' || !DATE_PATTERN.test(item.date.trim())) {
      continue
    }

    if (typeof item.score !== 'number' || !Number.isInteger(item.score)) {
      continue
    }

    items.push({
      date: item.date.trim(),
      score: Math.min(100, Math.max(0, item.score)),
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    })
  }

  return items
}

function normalizeConfidence(value: unknown): MemoryConfidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium'
}

function normalizeFindings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function summarizeEntries(
  client: AiChatClient,
  systemPrompt: string,
  query: string,
  entries: MemoryEntryDocument[],
): Promise<{ answer: string; findings: string[]; confidence: MemoryConfidence }> {
  const entryBlocks = entries.map((entry) => {
    const truncatedBody =
      entry.body.length > MAX_BODY_CHARS_FOR_SUMMARY
        ? `${entry.body.slice(0, MAX_BODY_CHARS_FOR_SUMMARY)}\n……（正文过长，已截断）`
        : entry.body

    return [`### ${entry.date}`, `摘要: ${entry.summary || '（无）'}`, '正文:', truncatedBody].join(
      '\n',
    )
  })

  const userPrompt = [`用户查询：${query}`, '相关日记：', entryBlocks.join('\n\n')].join('\n\n')

  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const payload = extractJsonObject<SummarizePayload>(responseText)
  const answer = typeof payload.answer === 'string' ? payload.answer.trim() : ''
  if (!answer) {
    throw new Error('大模型返回的总结为空，请稍后重试。')
  }

  return {
    answer,
    findings: normalizeFindings(payload.findings),
    confidence: normalizeConfidence(payload.confidence),
  }
}

export async function searchMemory(input: MemorySearchInput): Promise<MemorySearchResult> {
  const workspacePath = input.workspacePath.trim()
  const query = input.query.trim()

  if (!workspacePath) {
    throw new Error('当前还没有可用的工作区。')
  }

  if (!query) {
    throw new Error('检索内容为空，请输入要查找的内容。')
  }

  const years = normalizeYears(input.years) ?? (await listJournalYears(workspacePath))
  const candidates = await readMetaCandidates(workspacePath, years)

  if (candidates.length === 0) {
    return createEmptyResult(query, '当前工作区没有可检索的日记。')
  }

  const [config, filterSystemPrompt, rerankSystemPrompt, summarizeSystemPrompt] =
    await Promise.all([
      readAppConfig(),
      loadPrompt('memorySearchFilterSystem'),
      loadPrompt('memorySearchRerankSystem'),
      loadPrompt('memorySearchSummarizeSystem'),
    ])
  const settings = ensureAiSettingsReady(config)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  settings.timeoutMs = Math.max(settings.timeoutMs, 60_000)
  const client = createAiChatClient(settings, apiKey)

  // 第一阶段：基于元信息粗筛候选日期
  const candidateDateSet = new Set(candidates.map((candidate) => candidate.date))
  const filterChunks = splitIntoChunks(candidates, FILTER_CHUNK_SIZE)
  const filterResults = await Promise.all(
    filterChunks.map((chunk) => filterCandidateDates(client, filterSystemPrompt, query, chunk)),
  )
  const journalListA = uniqDates(filterResults.flat())
    .filter((date) => candidateDateSet.has(date))
    .sort()

  if (journalListA.length === 0) {
    return createEmptyResult(query, '没有找到与查询相关的日记，可以换个说法或关键词再试。')
  }

  // 第二阶段：读取正文精筛，按相关度打分排序（检索内部忽略 skippedDates）
  const { entries } = await batchReadEntries(workspacePath, journalListA)
  const rerankChunks = splitIntoChunks(entries, RERANK_CHUNK_SIZE)
  const rerankResults = await Promise.all(
    rerankChunks.map((chunk) => rerankEntries(client, rerankSystemPrompt, query, chunk)),
  )
  const entryDateSet = new Set(entries.map((entry) => entry.date))
  const journalListB = uniqDates(
    rerankResults
      .flat()
      .filter((item) => item.score >= RERANK_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.date),
  ).filter((date) => entryDateSet.has(date))

  if (journalListB.length === 0) {
    return createEmptyResult(query, '没有找到与查询相关的日记，可以换个说法或关键词再试。')
  }

  // 第三阶段：基于全部入选日记生成详细回答与发现
  const limit = normalizeLimit(input.limit)
  const displayedDates = journalListB.slice(0, limit)
  const entryMap = new Map(entries.map((entry) => [entry.date, entry]))
  const summarizeTargets = displayedDates
    .map((date) => entryMap.get(date))
    .filter((entry): entry is MemoryEntryDocument => Boolean(entry))
  const summary = await summarizeEntries(client, summarizeSystemPrompt, query, summarizeTargets)

  return {
    query,
    answer: summary.answer,
    findings: summary.findings,
    relatedDates: displayedDates,
    displayedCount: displayedDates.length,
    totalCount: journalListB.length,
    confidence: summary.confidence,
  }
}
