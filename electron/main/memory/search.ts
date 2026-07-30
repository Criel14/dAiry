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
const FILTER_CHUNK_SIZE = 100
const RERANK_CHUNK_SIZE = 3
const RERANK_MIN_SCORE = 60
const MAX_BODY_CHARS_FOR_RERANK = 1800
const MAX_BODY_CHARS_FOR_SUMMARY = 4000
// AI 调用并发上限：无界并发对总时长没有帮助，只会放大 provider 限流风险
const MAX_AI_CONCURRENCY = 5
const MAX_FINDINGS_COUNT = 3

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

// 有界并发映射：worker 池逐个领取任务，避免一次性打出全部请求
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
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

function normalizeFindings(value: unknown, answer: string): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const findings: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const trimmed = item.trim()
    // 与 answer 重复的条目直接丢弃；语义级去重由 prompt 约束，这里只做字符串级兜底
    if (!trimmed || findings.includes(trimmed) || answer.includes(trimmed)) {
      continue
    }

    findings.push(trimmed)
    if (findings.length >= MAX_FINDINGS_COUNT) {
      break
    }
  }

  return findings
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
    findings: normalizeFindings(payload.findings, answer),
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
  // 总结调用可能承载大量正文（最多 20 篇），单独放宽超时；其余调用超时挂起时快速失败
  const summarizeClient = createAiChatClient(
    { ...settings, timeoutMs: Math.max(settings.timeoutMs, 180_000) },
    apiKey,
  )

  // 第一阶段：基于元信息粗筛候选日期；单个分块失败按空结果处理，避免一次超时拖垮整个检索
  const filterStartedAt = Date.now()
  const candidateDateSet = new Set(candidates.map((candidate) => candidate.date))
  const filterChunks = splitIntoChunks(candidates, FILTER_CHUNK_SIZE)
  const filterResults = await mapWithConcurrency(
    filterChunks,
    MAX_AI_CONCURRENCY,
    async (chunk) => {
      try {
        return await filterCandidateDates(client, filterSystemPrompt, query, chunk)
      } catch (error) {
        console.warn('[memory] 粗筛分块失败，按空结果处理：', error)
        return [] as string[]
      }
    },
  )
  const journalListA = uniqDates(filterResults.flat())
    .filter((date) => candidateDateSet.has(date))
    .sort()
  console.info(
    `[memory] 粗筛完成：${candidates.length} 候选 -> ${journalListA.length} 入选，耗时 ${Date.now() - filterStartedAt}ms`,
  )

  if (journalListA.length === 0) {
    return createEmptyResult(query, '没有找到与查询相关的日记，可以换个说法或关键词再试。')
  }

  // 第二阶段：读取正文精筛，按相关度打分排序（检索内部忽略 skippedDates）；分块失败同样按空结果处理
  const rerankStartedAt = Date.now()
  const { entries } = await batchReadEntries(workspacePath, journalListA)
  const rerankChunks = splitIntoChunks(entries, RERANK_CHUNK_SIZE)
  const rerankResults = await mapWithConcurrency(
    rerankChunks,
    MAX_AI_CONCURRENCY,
    async (chunk) => {
      try {
        return await rerankEntries(client, rerankSystemPrompt, query, chunk)
      } catch (error) {
        console.warn('[memory] 精筛分块失败，按空结果处理：', error)
        return [] as RerankItem[]
      }
    },
  )
  const entryDateSet = new Set(entries.map((entry) => entry.date))
  const journalListB = uniqDates(
    rerankResults
      .flat()
      .filter((item) => item.score >= RERANK_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.date),
  ).filter((date) => entryDateSet.has(date))
  console.info(
    `[memory] 精筛完成：${entries.length} 评估 -> ${journalListB.length} 入选，耗时 ${Date.now() - rerankStartedAt}ms`,
  )

  if (journalListB.length === 0) {
    return createEmptyResult(query, '没有找到与查询相关的日记，可以换个说法或关键词再试。')
  }

  // 第三阶段：基于全部入选日记生成详细回答与发现；失败时降级返回日期列表，不浪费前两个阶段的成果
  const limit = normalizeLimit(input.limit)
  const displayedDates = journalListB.slice(0, limit)
  const entryMap = new Map(entries.map((entry) => [entry.date, entry]))
  const summarizeTargets = displayedDates
    .map((date) => entryMap.get(date))
    .filter((entry): entry is MemoryEntryDocument => Boolean(entry))

  const summarizeStartedAt = Date.now()
  try {
    const summary = await summarizeEntries(
      summarizeClient,
      summarizeSystemPrompt,
      query,
      summarizeTargets,
    )
    console.info(
      `[memory] 总结完成：${summarizeTargets.length} 篇，耗时 ${Date.now() - summarizeStartedAt}ms`,
    )

    return {
      query,
      answer: summary.answer,
      findings: summary.findings,
      relatedDates: displayedDates,
      displayedCount: displayedDates.length,
      totalCount: journalListB.length,
      confidence: summary.confidence,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return {
      query,
      answer: `已找到 ${journalListB.length} 篇相关日记，但生成详细回答时失败（${message}）。可以根据 relatedDates 调用 memory_batch_read_entries 直接阅读原文。`,
      findings: [],
      relatedDates: displayedDates,
      displayedCount: displayedDates.length,
      totalCount: journalListB.length,
      confidence: 'low',
    }
  }
}
