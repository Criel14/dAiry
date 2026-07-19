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
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }
    return JSON.parse(jsonMatch[0]) as ExtractResult
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

export async function rebuildTimelineYear(
  workspacePath: string,
  year: number,
  onProgress: (progress: { weekLabel: string; current: number; total: number }) => void,
): Promise<TimelineEvent[] | null> {
  const allEvents: TimelineEvent[] = []
  const start = dayjs(`${year}-01-01`)
  const end = dayjs(`${year}-12-31`)
  const weeks: Array<{ start: string; end: string }> = []
  let cursor = start

  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const weekStart = cursor.format('YYYY-MM-DD')
    const weekEnd = cursor.add(6, 'day')
    weeks.push({
      start: weekStart,
      end: weekEnd.isAfter(end) ? end.format('YYYY-MM-DD') : weekEnd.format('YYYY-MM-DD'),
    })
    cursor = weekEnd.add(1, 'day')
  }

  const cancelToken = { cancelled: false }
  __timelineCancelTokens.set(year, cancelToken)

  for (let i = 0; i < weeks.length; i++) {
    const { start: weekStart, end: weekEnd } = weeks[i]
    onProgress({ weekLabel: `${weekStart} ~ ${weekEnd}`, current: i + 1, total: weeks.length })

    if (cancelToken.cancelled) {
      return null
    }

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
    let dayCursor = dayjs(weekStart)
    while (dayCursor.isBefore(dayjs(weekEnd)) || dayCursor.isSame(dayjs(weekEnd), 'day')) {
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

    const existingEventsBlock =
      allEvents.length > 0
        ? '当前已有事件：\n' +
          allEvents
            .map((e) => `- id: ${e.id}, title: ${e.title}, date: ${e.date}`)
            .join('\n')
        : ''

    const userPrompt = [
      `正在重建 ${year} 年时间轴，当前批次：${weekStart} ~ ${weekEnd}`,
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
