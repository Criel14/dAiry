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
import { readTimelineYear, writeTimelineYear, mergeEvents } from './service'

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

  settings.timeoutMs = Math.max(settings.timeoutMs, 60_000)
  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeText({
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

  for (let i = 0; i < batches.length; i++) {
    if (cancelToken.cancelled) {
      __timelineCancelTokens.delete(year)
      console.log(`[timeline] ${year} 年时间轴重建已取消。`)
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
      aiContext.trim() ? `补充知识：\n${aiContext.trim()}` : '',
      ...bodies,
    ]
      .filter(Boolean)
      .join('\n\n')

    settings.timeoutMs = Math.max(settings.timeoutMs, 60_000)
    const client = createAiChatClient(settings, apiKey)
    const responseText = await client.completeText({
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
  console.log(
    `[timeline] ${year} 年时间轴重建完成：${diaryBatchCount}/${totalBatches} 个批次有日记，共提取 ${allEvents.length} 个事件。`,
  )
  return { events: allEvents, diaryBatchCount }
}

export function cancelTimelineRebuild(year: number): void {
  const token = __timelineCancelTokens.get(year)
  if (token) {
    token.cancelled = true
  }
}

export async function updateTimelineForDay(
  workspacePath: string,
  date: string,
): Promise<void> {
  const year = Number.parseInt(date.split('-')[0], 10)
  // 时间轴文件不存在时自动初始化，从整理当天开始建立
  const existingData = readTimelineYear(workspacePath, year) ?? {
    year,
    version: 1,
    generatedAt: new Date().toISOString(),
    events: [],
  }

  try {
    const result = await extractEventsFromDay(workspacePath, date, existingData.events)

    if (result.newEvents.length === 0 && result.updatedEvents.length === 0) {
      return
    }

    const mergedEvents = mergeEvents(existingData.events, result.newEvents)

    for (const update of result.updatedEvents) {
      const idx = mergedEvents.findIndex((e) => e.id === update.id)
      if (idx !== -1) {
        if (update.dateEnd !== undefined) mergedEvents[idx].dateEnd = update.dateEnd
        if (update.detail !== undefined) mergedEvents[idx].detail = update.detail
      }
    }

    const updatedData = {
      ...existingData,
      events: mergedEvents,
      generatedAt: new Date().toISOString(),
    }

    writeTimelineYear(workspacePath, updatedData)
  } catch (err) {
    console.error('时间轴日更失败：', err)
  }
}
