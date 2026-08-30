import dayjs from 'dayjs'
import type { TimelineEvent } from '../../../src/types/timeline'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { readAppConfig, normalizeAiSettings } from '../app-config'
import { readSupplement } from '../ai/context'
import { readAiApiKey } from '../secrets'
import { createAiChatClient } from '../ai/provider-factory'
import { withAiRetry } from '../ai/retry'
import { loadPrompt } from '../ai/prompt-loader'
import { readJournalDocument } from '../journal/document'
import { readUserProfile } from '../profile/profile-service'
import {
  readTimelineYear,
  stripLegacyDateEnd,
  upsertEventForDate,
  writeTimelineYear,
} from './service'

interface ExtractResult {
  newEvents: TimelineEvent[]
  updatedEvents: Array<{ id: string; dateEnd?: string | null; detail?: string }>
}

function extractJsonObject(rawText: string): ExtractResult {
  let text = rawText.trim()

  // 1. 去掉 markdown 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim()
  }

  // 2. 直接解析
  try {
    return JSON.parse(text) as ExtractResult
  } catch {
    // 继续
  }

  // 3. 找到第一个完整的 JSON 对象
  const jsonMatch = text.match(/\{[\s\S]*\}(?=\s*$)/) || text.match(/\{[\s\S]*?\}(?=\s*\n)/) || text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    let candidate = jsonMatch[0]
    // 修复常见 JSON 错误：尾部逗号
    candidate = candidate.replace(/,(\s*[}\]])/g, '$1')

    try {
      return JSON.parse(candidate) as ExtractResult
    } catch {
      // 修复未转义的字符串内容
      candidate = fixUnescapedStrings(candidate)
      try {
        return JSON.parse(candidate) as ExtractResult
      } catch {
        // 失败，继续
      }
    }
  }

  // 4. 所有尝试失败
  const preview = rawText.length > 300 ? rawText.slice(0, 300) + '...' : rawText
  throw new Error(
    `大模型返回内容无法解析为 JSON。返回内容预览：\n${preview}`,
  )
}

function fixUnescapedStrings(json: string): string {
  // 处理可能包含未转义换行的字符串值
  const fields = ['detail', 'title', 'note']
  for (const field of fields) {
    const regex = new RegExp(`"${field}":\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g')
    json = json.replace(regex, (_match: string, p1: string) => {
      const escaped = p1
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
      return `"${field}": "${escaped}"`
    })
  }
  return json
}

const __timelineCancelTokens = new Map<number, { cancelled: boolean }>()

class TimelineCancelledError extends Error {
  constructor() {
    super('时间轴重建已取消。')
    this.name = 'TimelineCancelledError'
  }
}

function buildBatches(start: dayjs.Dayjs, end: dayjs.Dayjs): Array<{ start: string; end: string }> {
  const batches: Array<{ start: string; end: string }> = []
  let cursor = start

  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const batchStart = cursor.format('YYYY-MM-DD')
    const batchEnd = cursor.add(2, 'day')
    batches.push({
      start: batchStart,
      end: batchEnd.isAfter(end) ? end.format('YYYY-MM-DD') : batchEnd.format('YYYY-MM-DD'),
    })
    cursor = batchEnd.add(1, 'day')
  }

  return batches
}

export async function rebuildTimelineYear(
  workspacePath: string,
  year: number,
  onProgress: (progress: { weekLabel: string; current: number; total: number }) => void,
): Promise<{ events: TimelineEvent[]; diaryBatchCount: number } | null> {
  const allEvents: TimelineEvent[] = []
  const start = dayjs(`${year}-01-01`)
  const end = dayjs(`${year}-12-31`)

  const batches = buildBatches(start, end)
  const totalBatches = batches.length

  const cancelToken = { cancelled: false }
  __timelineCancelTokens.set(year, cancelToken)

  let completedCount = 0
  let diaryBatchCount = 0

  console.log(`[timeline] 开始重建 ${year} 年时间轴，共 ${totalBatches} 个批次。`)

  const finishCancelled = () => {
    __timelineCancelTokens.delete(year)
    console.log(`[timeline] ${year} 年时间轴重建已取消。`)
    return null
  }

  for (let i = 0; i < batches.length; i++) {
    if (cancelToken.cancelled) {
      return finishCancelled()
    }

    const { start: batchStart, end: batchEnd } = batches[i]

    const [config, systemPrompt, supplement] = await Promise.all([
      readAppConfig(),
      loadPrompt('timelineExtractSystem'),
      readSupplement(workspacePath),
    ])

    const settings = normalizeAiSettings(config.ai)
    const apiKey = await readAiApiKey(settings.providerType)

    if (!apiKey) {
      throw new Error('请先在设置页保存当前 provider 的 API Key。')
    }

    const bodies: string[] = []
    let dayCursor = dayjs(batchStart)
    while (dayCursor.isBefore(dayjs(batchEnd)) || dayCursor.isSame(dayjs(batchEnd), 'day')) {
      const dayStr = dayCursor.format('YYYY-MM-DD')

      try {
        const { body } = await readJournalDocument(
          resolveJournalEntryFilePath(workspacePath, dayStr),
        )
        if (body.trim()) {
          bodies.push(`## ${dayStr}\n${body}`)
        }
      } catch {
        // 当天没有日记，跳过
      }

      dayCursor = dayCursor.add(1, 'day')
    }

    if (bodies.length === 0) {
      continue
    }

    completedCount++
    diaryBatchCount++
    onProgress({ weekLabel: `${batchStart} ~ ${batchEnd}`, current: completedCount, total: totalBatches })
    console.log(`[timeline] ${year} 年批次 ${batchStart} ~ ${batchEnd}：${bodies.length} 篇日记，等待 AI 提取事件。`)

    const existingEventsBlock =
      allEvents.length > 0
        ? '当前已有事件：\n' +
          allEvents
            .map((e) => `- id: ${e.id}, title: ${e.title}, date: ${e.date}`)
            .join('\n')
        : ''

    const userPrompt = [
      `正在重建 ${year} 年时间轴，当前批次：${batchStart} ~ ${batchEnd}`,
      existingEventsBlock,
      supplement.trim() ? `补充知识：\n${supplement.trim()}` : '',
      ...bodies,
    ]
      .filter(Boolean)
      .join('\n\n')

    let responseText: string
    try {
      responseText = await withAiRetry(
        (timeoutMs) => createAiChatClient(settings, apiKey, timeoutMs),
        (client) => {
          if (cancelToken.cancelled) {
            throw new TimelineCancelledError()
          }
          return client.completeText({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          })
        },
        { minTimeoutMs: 120_000, label: '时间轴年度重建' },
      )
    } catch (err) {
      if (err instanceof TimelineCancelledError) {
        return finishCancelled()
      }
      throw err
    }

    if (cancelToken.cancelled) {
      return finishCancelled()
    }

    const result = extractJsonObject(responseText)

    for (const event of result.newEvents) {
      const exists = allEvents.some((e) => e.id === event.id)
      if (!exists) {
        allEvents.push(event)
      }
    }

    for (const update of result.updatedEvents) {
      const idx = allEvents.findIndex((e) => e.id === update.id)
      if (idx !== -1) {
        if (update.detail !== undefined) allEvents[idx].detail = update.detail
      }
    }
  }

  __timelineCancelTokens.delete(year)
  console.log(
    `[timeline] ${year} 年时间轴重建完成：${diaryBatchCount}/${totalBatches} 个批次有日记，共提取 ${allEvents.length} 个事件。`,
  )
  return { events: allEvents.map(stripLegacyDateEnd), diaryBatchCount }
}

export function cancelTimelineRebuild(year: number): void {
  const token = __timelineCancelTokens.get(year)
  if (token) {
    token.cancelled = true
  }
}

const MAX_RECENT_BODY_LENGTH = 2200

function truncateRecentBody(body: string) {
  const normalizedBody = body.trim()
  if (normalizedBody.length <= MAX_RECENT_BODY_LENGTH) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, MAX_RECENT_BODY_LENGTH)}...`
}

export interface ExtractedDayEvent {
  title: string
  detail: string
}

function extractDayEventJson(rawText: string): { title?: unknown; detail?: unknown } {
  let text = rawText.trim()

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim()
  }

  try {
    return JSON.parse(text) as { title?: unknown; detail?: unknown }
  } catch {
    // 继续
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const candidate = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1')
    try {
      return JSON.parse(candidate) as { title?: unknown; detail?: unknown }
    } catch {
      // 继续
    }
  }

  const preview = rawText.length > 300 ? rawText.slice(0, 300) + '...' : rawText
  throw new Error(`大模型返回内容无法解析为 JSON。返回内容预览：\n${preview}`)
}

// 确认制单日事件提取：当天全文 + 近 7 天全文（截断保护）+ 画像/补充资料（非空才拼）
export async function extractTimelineEventForDay(
  workspacePath: string,
  date: string,
): Promise<ExtractedDayEvent> {
  assertValidDate(date)

  const [config, systemPrompt, supplement, userProfile] = await Promise.all([
    readAppConfig(),
    loadPrompt('timelineEventExtractSystem'),
    readSupplement(workspacePath),
    readUserProfile(workspacePath, date.slice(0, 4)),
  ])

  const settings = normalizeAiSettings(config.ai)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  let body: string
  try {
    const document = await readJournalDocument(
      resolveJournalEntryFilePath(workspacePath, date),
    )
    body = document.body
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('当天还没有写日记，无法整理时间轴事件。')
    }
    throw error
  }

  if (!body.trim()) {
    throw new Error('当天还没有写日记，无法整理时间轴事件。')
  }

  const recentBodies: string[] = []
  for (let offset = 7; offset >= 1; offset -= 1) {
    const targetDate = dayjs(date).subtract(offset, 'day').format('YYYY-MM-DD')

    try {
      const document = await readJournalDocument(
        resolveJournalEntryFilePath(workspacePath, targetDate),
      )
      if (document.body.trim()) {
        recentBodies.push(`## ${targetDate}\n${truncateRecentBody(document.body)}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }
  }

  const userPrompt = [
    `业务日期：${date}`,
    recentBodies.length > 0
      ? `近期日记（过去 7 天，仅作背景参考）：\n${recentBodies.join('\n\n')}`
      : '',
    supplement.trim() ? `补充知识：\n${supplement.trim()}` : '',
    userProfile.trim() ? `用户画像：\n${userProfile.trim()}` : '',
    '当日日记：',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')

  const responseText = await withAiRetry(
    (timeoutMs) => createAiChatClient(settings, apiKey, timeoutMs),
    (client) =>
      client.completeJson({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    { minTimeoutMs: 120_000, label: '时间轴事件提取' },
  )

  const payload = extractDayEventJson(responseText)
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const detail = typeof payload.detail === 'string' ? payload.detail.trim() : ''

  return { title, detail }
}

// 提取并落盘单日事件（IPC 与 MCP 共用）：同一天已有事件则覆盖更新
export async function addTimelineDayEvent(
  workspacePath: string,
  date: string,
): Promise<{ recorded: boolean; reason?: 'empty'; event?: TimelineEvent }> {
  const { title, detail } = await extractTimelineEventForDay(workspacePath, date)

  if (!title.trim()) {
    return { recorded: false, reason: 'empty' }
  }

  const year = Number.parseInt(date.split('-')[0], 10)
  const existingData = readTimelineYear(workspacePath, year) ?? {
    year,
    version: 2,
    generatedAt: new Date().toISOString(),
    events: [],
  }

  const { events } = upsertEventForDate(existingData.events, date, { title, detail })
  const updatedData = {
    ...existingData,
    version: 2,
    events,
    generatedAt: new Date().toISOString(),
  }

  writeTimelineYear(workspacePath, updatedData)

  const event = events.find((e) => e.date === date)
  return { recorded: true, event }
}
