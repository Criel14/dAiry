import dayjs from 'dayjs'
import type { TimelineEvent } from '../../../src/types/timeline'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { readAppConfig, normalizeAiSettings } from '../app-config'
import { readAiContext } from '../ai/context'
import { readAiApiKey } from '../secrets'
import { createAiChatClient } from '../ai/provider-factory'
import { loadPrompt } from '../ai/prompt-loader'
import { readJournalDocument } from '../journal/document'
import { getRecentDailySummaries } from '../ai/journal-ai-service'

interface ExtractResult {
  newEvents: TimelineEvent[]
  updatedEvents: Array<{ id: string; dateEnd?: string | null; detail?: string }>
}

function extractJsonObject(text: string): ExtractResult {
  const trimmedText = text.trim()

  try {
    return JSON.parse(trimmedText) as ExtractResult
  } catch {
    // 尝试找到 JSON 块
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }

    let candidate = jsonMatch[0]
    try {
      return JSON.parse(candidate) as ExtractResult
    } catch {
      // JSON 中的字符串字段可能包含未转义的换行，尝试修复
      candidate = candidate.replace(/"detail":\s*"([^"]*)"/g, (_match: string, p1: string) => {
        const escaped = p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return `"detail": "${escaped}"`
      })
      candidate = candidate.replace(/"summary":\s*"([^"]*)"/g, (_match: string, p1: string) => {
        const escaped = p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return `"summary": "${escaped}"`
      })
      candidate = candidate.replace(/"title":\s*"([^"]*)"/g, (_match: string, p1: string) => {
        const escaped = p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return `"title": "${escaped}"`
      })

      try {
        return JSON.parse(candidate) as ExtractResult
      } catch {
        throw new Error('大模型返回的 JSON 格式无法解析，请稍后重试。')
      }
    }
  }
}

export async function extractEventsFromDay(
  workspacePath: string,
  date: string,
  existingEvents: TimelineEvent[],
): Promise<ExtractResult> {
  assertValidDate(date)

  const [config, systemPrompt, aiContext] = await Promise.all([
    readAppConfig(),
    loadPrompt('timelineExtractSystem'),
    readAiContext(),
  ])

  const settings = normalizeAiSettings(config.ai)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  const { body } = await readJournalDocument(
    resolveJournalEntryFilePath(workspacePath, date),
  )

  if (!body.trim()) {
    return { newEvents: [], updatedEvents: [] }
  }

  const recentSummaries = await getRecentDailySummaries(
    workspacePath,
    date,
    settings.dailyContextDays,
  )

  const existingEventsBlock =
    existingEvents.length > 0
      ? '已有事件列表：\n' +
        existingEvents
          .map(
            (e) =>
              `- id: ${e.id}, title: ${e.title}, date: ${e.date}, dateEnd: ${e.dateEnd ?? '进行中'}`,
          )
          .join('\n')
      : '暂无已有事件'

  const contextBlock =
    recentSummaries.length > 0
      ? '最近日记上下文：\n' +
        recentSummaries.map((s) => `- ${s.date}: ${s.summary || '无摘要'}`).join('\n')
      : ''

  const userPrompt = [
    `业务日期：${date}`,
    contextBlock,
    existingEventsBlock,
    aiContext.trim() ? `补充知识：\n${aiContext.trim()}` : '',
    '当日日记：',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')

  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const result = extractJsonObject(responseText)
  return {
    newEvents: Array.isArray(result.newEvents) ? result.newEvents : [],
    updatedEvents: Array.isArray(result.updatedEvents) ? result.updatedEvents : [],
  }
}

const __timelineCancelTokens = new Map<number, { cancelled: boolean }>()

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
): Promise<TimelineEvent[] | null> {
  const allEvents: TimelineEvent[] = []
  const start = dayjs(`${year}-01-01`)
  const end = dayjs(`${year}-12-31`)

  const batches = buildBatches(start, end)
  const totalBatches = batches.length

  const cancelToken = { cancelled: false }
  __timelineCancelTokens.set(year, cancelToken)

  let completedCount = 0

  for (let i = 0; i < batches.length; i++) {
    if (cancelToken.cancelled) {
      return null
    }

    const { start: batchStart, end: batchEnd } = batches[i]

    const [config, systemPrompt, aiContext] = await Promise.all([
      readAppConfig(),
      loadPrompt('timelineExtractSystem'),
      readAiContext(),
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
    onProgress({ weekLabel: `${batchStart} ~ ${batchEnd}`, current: completedCount, total: totalBatches })

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
      aiContext.trim() ? `补充知识：\n${aiContext.trim()}` : '',
      ...bodies,
    ]
      .filter(Boolean)
      .join('\n\n')

    const client = createAiChatClient(settings, apiKey, 120000)
    const responseText = await client.completeJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

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
        if (update.dateEnd !== undefined) allEvents[idx].dateEnd = update.dateEnd
        if (update.detail !== undefined) allEvents[idx].detail = update.detail
      }
    }
  }

  __timelineCancelTokens.delete(year)
  return allEvents
}

export function cancelTimelineRebuild(year: number): void {
  const token = __timelineCancelTokens.get(year)
  if (token) {
    token.cancelled = true
  }
}
