import dayjs from 'dayjs'
import type { AiSettings } from '../../../src/types/ai'
import type {
  RangeReport,
  RangeReportSummary,
  ReportSummaryItem,
  ReportSummaryTimeAnchor,
} from '../../../src/types/report'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { readSupplement } from './context'
import { readAiApiKey } from '../secrets'
import { createAiChatClient } from './provider-factory'
import { loadPrompt } from './prompt-loader'
import { withAiRetry } from './retry'
import { createRangeReportChat } from './range-report-chat'
import { getUserProfile } from '../memory'

export interface RangeReportSummarySourceEntry {
  date: string
  body: string
  summary: string
  tags: string[]
  mood: number | null
  wordCount: number
  location: string
  insightSource: 'frontmatter' | 'generated' | 'missing'
}

interface RangeReportSummaryPayload {
  text?: unknown
  progress?: unknown
  blockers?: unknown
  memorableMoments?: unknown
}

interface RangeReportSummaryItemPayload {
  text?: unknown
  timeAnchor?: unknown
}

interface FocusSelectionPayload {
  focusDates?: unknown
}

interface FocusSelectionItem {
  date: string
  reason: string
}

interface RangeReportWithContext extends RangeReport {
  supplement: string
  userProfile: string
}

interface TimeAnchorPayload {
  type?: unknown
  label?: unknown
  startDate?: unknown
  endDate?: unknown
  dates?: unknown
}

const MAX_FOCUS_ENTRY_COUNT = 6
const FULL_CONTEXT_ENTRY_THRESHOLD = 7
const MAX_BODY_LENGTH = 2200
const MAX_SUMMARY_LENGTH = 84
const FOCUS_TIMEOUT_FLOOR_MS = 60_000

function extractJsonObject<T>(text: string) {
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

function normalizeDate(value: unknown, availableDates: Set<string>) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedDate = value.trim()
  if (!availableDates.has(normalizedDate)) {
    return null
  }

  return normalizedDate
}

function normalizeDateArray(value: unknown, availableDates: Set<string>) {
  if (!Array.isArray(value)) {
    return []
  }

  const uniqueDates = new Set<string>()

  for (const item of value) {
    const normalizedDate = normalizeDate(item, availableDates)
    if (!normalizedDate) {
      continue
    }

    uniqueDates.add(normalizedDate)
  }

  return [...uniqueDates].sort((left, right) => left.localeCompare(right))
}

function formatMonthDay(date: string) {
  const parsedDate = dayjs(date)
  return parsedDate.isValid() ? parsedDate.format('M月D日') : date
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatMonthDay(startDate)
  }

  return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`
}

function formatMultipleDatesLabel(dates: string[]) {
  if (dates.length === 0) {
    return '这段时间'
  }

  if (dates.length <= 3) {
    return dates.map((date) => formatMonthDay(date)).join('、')
  }

  return `${formatMonthDay(dates[0])} 等 ${dates.length} 天`
}

function normalizeTimeAnchor(
  value: unknown,
  availableDates: Set<string>,
): ReportSummaryTimeAnchor {
  const payload = value && typeof value === 'object' ? (value as TimeAnchorPayload) : null
  const label = typeof payload?.label === 'string' ? payload.label.trim() : ''
  const startDate = normalizeDate(payload?.startDate, availableDates)
  const endDate = normalizeDate(payload?.endDate, availableDates)
  const dates = normalizeDateArray(payload?.dates, availableDates)
  const rawType = typeof payload?.type === 'string' ? payload.type.trim() : ''

  const inferType = () => {
    if (rawType === 'day' || rawType === 'range' || rawType === 'multiple' || rawType === 'approx') {
      return rawType
    }

    if (dates.length > 1) {
      return 'multiple'
    }

    if (startDate && endDate && startDate !== endDate) {
      return 'range'
    }

    if (startDate || endDate || dates.length === 1) {
      return 'day'
    }

    return 'approx'
  }

  const type = inferType()

  if (type === 'day') {
    const day = startDate ?? endDate ?? dates[0]
    if (day) {
      return {
        type: 'day',
        label: label || formatMonthDay(day),
        startDate: day,
      }
    }
  }

  if (type === 'range') {
    const normalizedStartDate = startDate ?? dates[0]
    const normalizedEndDate = endDate ?? dates[dates.length - 1] ?? normalizedStartDate

    if (normalizedStartDate && normalizedEndDate) {
      const [orderedStartDate, orderedEndDate] =
        normalizedStartDate <= normalizedEndDate
          ? [normalizedStartDate, normalizedEndDate]
          : [normalizedEndDate, normalizedStartDate]

      if (orderedStartDate === orderedEndDate) {
        return {
          type: 'day',
          label: label || formatMonthDay(orderedStartDate),
          startDate: orderedStartDate,
        }
      }

      return {
        type: 'range',
        label: label || formatDateRangeLabel(orderedStartDate, orderedEndDate),
        startDate: orderedStartDate,
        endDate: orderedEndDate,
      }
    }
  }

  if (type === 'multiple') {
    const normalizedDates = dates.length > 0 ? dates : [startDate, endDate].filter(Boolean) as string[]

    if (normalizedDates.length === 1) {
      return {
        type: 'day',
        label: label || formatMonthDay(normalizedDates[0]),
        startDate: normalizedDates[0],
      }
    }

    if (normalizedDates.length > 1) {
      return {
        type: 'multiple',
        label: label || formatMultipleDatesLabel(normalizedDates),
        dates: normalizedDates,
      }
    }
  }

  if (startDate && endDate && startDate !== endDate) {
    const [orderedStartDate, orderedEndDate] =
      startDate <= endDate ? [startDate, endDate] : [endDate, startDate]

    return {
      type: 'approx',
      label: label || formatDateRangeLabel(orderedStartDate, orderedEndDate),
      startDate: orderedStartDate,
      endDate: orderedEndDate,
    }
  }

  if (dates.length > 1) {
    return {
      type: 'approx',
      label: label || formatMultipleDatesLabel(dates),
      dates,
    }
  }

  if (startDate) {
    return {
      type: 'day',
      label: label || formatMonthDay(startDate),
      startDate,
    }
  }

  return {
    type: 'approx',
    label: label || '这段时间',
  }
}

function normalizeSummaryItems(
  value: unknown,
  maxLength: number,
  availableDates: Set<string>,
) {
  if (!Array.isArray(value)) {
    return []
  }

  const normalizedItems: ReportSummaryItem[] = []
  const uniqueKeys = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const payload = item as RangeReportSummaryItemPayload
    const text = typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!text) {
      continue
    }

    const timeAnchor = normalizeTimeAnchor(payload.timeAnchor, availableDates)
    const dedupeKey = `${text}::${timeAnchor.label}`
    if (uniqueKeys.has(dedupeKey)) {
      continue
    }

    uniqueKeys.add(dedupeKey)
    normalizedItems.push({
      text,
      timeAnchor,
    })

    if (normalizedItems.length >= maxLength) {
      break
    }
  }

  return normalizedItems
}

function normalizeSummaryPayload(
  payload: RangeReportSummaryPayload,
  availableDates: Set<string>,
): RangeReportSummary {
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    throw new Error('大模型返回的区间总结为空。')
  }

  return {
    text,
    progress: normalizeSummaryItems(payload.progress, 4, availableDates),
    blockers: normalizeSummaryItems(payload.blockers, 4, availableDates),
    memorableMoments: normalizeSummaryItems(payload.memorableMoments, 4, availableDates),
  }
}

function ensureAiSettingsReady(config: Awaited<ReturnType<typeof readAppConfig>>) {
  const settings = normalizeAiSettings(config.ai)

  if (!settings.baseURL || !settings.model) {
    throw new Error('请先完成区间总结所需的大模型配置。')
  }

  return settings
}

function truncateText(value: string, maxLength: number) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim()
  if (normalizedValue.length <= maxLength) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, maxLength)}...`
}

function buildEntryCompactDigest(entry: RangeReportSummarySourceEntry) {
  return {
    date: entry.date,
    summary: truncateText(entry.summary, MAX_SUMMARY_LENGTH),
    tags: entry.tags.slice(0, 4),
    mood: entry.mood,
    wordCount: entry.wordCount,
    location: entry.location,
    insightSource: entry.insightSource,
  }
}

function buildSummaryFacts(report: RangeReport) {
  return {
    topTags: report.sections.tagCloud?.items.slice(0, 12) ?? [],
    locations: report.sections.locationPatterns?.ranking.slice(0, 6) ?? [],
    timeBuckets: report.sections.timePatterns?.buckets ?? [],
    moodAverage: report.sections.moodTrend?.averageMood ?? null,
  }
}

async function readUserProfileContext(workspacePath: string): Promise<string> {
  try {
    const profile = await getUserProfile(workspacePath)
    return profile.content
  } catch {
    return ''
  }
}

function buildFocusSelectionPrompt(
  report: RangeReportWithContext,
  sourceEntries: RangeReportSummarySourceEntry[],
) {
  return buildPromptWithContexts(
    {
      period: report.period,
      source: report.source,
      facts: buildSummaryFacts(report),
      dailyCandidates: sourceEntries.map((entry) => buildEntryCompactDigest(entry)),
    },
    report.supplement,
    report.userProfile,
  )
}

function buildSummaryPrompt(
  report: RangeReportWithContext,
  sourceEntries: RangeReportSummarySourceEntry[],
  focusSelection: FocusSelectionItem[],
  includeContextDigest: boolean,
) {
  const sourceEntryMap = new Map(sourceEntries.map((entry) => [entry.date, entry]))
  const focusEntries = focusSelection
    .map((item) => {
      const entry = sourceEntryMap.get(item.date)
      if (!entry) {
        return null
      }

      return {
        date: entry.date,
        reason: item.reason,
        summary: entry.summary,
        tags: entry.tags,
        mood: entry.mood,
        wordCount: entry.wordCount,
        location: entry.location,
        insightSource: entry.insightSource,
        body: truncateText(entry.body, MAX_BODY_LENGTH),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const payload: Record<string, unknown> = {
    period: report.period,
    source: report.source,
    generation: {
      requestedSections: report.generation.requestedSections,
      warnings: report.generation.warnings,
    },
    facts: buildSummaryFacts(report),
    focusSelection,
    focusEntries,
  }

  if (includeContextDigest) {
    payload.contextDigest = sourceEntries.map((entry) => buildEntryCompactDigest(entry))
  }

  return buildPromptWithContexts(payload, report.supplement, report.userProfile)
}

function buildPromptWithContexts(payload: unknown, supplement: string, userProfile: string) {
  const promptParts = [JSON.stringify(payload, null, 2)]
  const normalizedSupplement = supplement.trim()

  if (normalizedSupplement) {
    promptParts.push(
      [
        '你在整理和总结时，可以参考以下补充知识。',
        '这些内容用于帮助你理解用户的长期背景、固定术语和偏好；如果与本次区间的实际事实冲突，以区间事实和日记内容为准。',
        normalizedSupplement,
      ].join('\n'),
    )
  }

  const normalizedProfile = userProfile.trim()
  if (normalizedProfile) {
    promptParts.push(
      [
        '以下是用户长期画像（自动维护，可能不完整或滞后）：',
        '它用于帮助你理解用户的长期偏好、习惯与正在推进的事项；如果与区间事实冲突，以区间事实和日记内容为准。',
        normalizedProfile,
      ].join('\n'),
    )
  }

  return promptParts.join('\n\n')
}

function scoreEntry(entry: RangeReportSummarySourceEntry) {
  return (
    entry.wordCount * 0.0015 +
    Math.abs(entry.mood ?? 0) * 20 +
    entry.tags.length * 8 +
    (entry.summary.trim() ? 12 : 0)
  )
}

function buildHeuristicFocusSelection(
  _report: RangeReport,
  sourceEntries: RangeReportSummarySourceEntry[],
) {
  if (sourceEntries.length <= FULL_CONTEXT_ENTRY_THRESHOLD) {
    return sourceEntries.map((entry) => ({
      date: entry.date,
      reason: '该日期在区间内有实际日记内容，直接纳入详细总结。',
    }))
  }

  const maxFocusCount = Math.min(MAX_FOCUS_ENTRY_COUNT, sourceEntries.length)
  const sortedEntries = [...sourceEntries].sort((left, right) => left.date.localeCompare(right.date))
  const bucketSize = Math.ceil(sortedEntries.length / maxFocusCount)
  const focusSelection: FocusSelectionItem[] = []

  for (let start = 0; start < sortedEntries.length && focusSelection.length < maxFocusCount; start += bucketSize) {
    const bucket = sortedEntries.slice(start, start + bucketSize)
    if (bucket.length === 0) {
      continue
    }

    const representative = bucket.reduce((best, entry) =>
      scoreEntry(entry) > scoreEntry(best) ? entry : best,
    )
    focusSelection.push({
      date: representative.date,
      reason: '该日期代表区间内的一个阶段，信息较集中，适合作为阶段样本。',
    })
  }

  return focusSelection
}

function normalizeFocusSelection(
  payload: FocusSelectionPayload,
  availableDates: Set<string>,
) {
  if (!Array.isArray(payload.focusDates)) {
    return []
  }

  const normalizedItems: FocusSelectionItem[] = []
  const selectedDates = new Set<string>()

  for (const item of payload.focusDates) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const date = normalizeDate((item as { date?: unknown }).date, availableDates)
    if (!date || selectedDates.has(date)) {
      continue
    }

    const reason =
      typeof (item as { reason?: unknown }).reason === 'string'
        ? (item as { reason?: string }).reason?.trim() || ''
        : ''

    selectedDates.add(date)
    normalizedItems.push({
      date,
      reason: reason || '该日期值得进一步查看。',
    })

    if (normalizedItems.length >= MAX_FOCUS_ENTRY_COUNT) {
      break
    }
  }

  return normalizedItems
}

interface FocusSelectionResult {
  selection: FocusSelectionItem[]
  userContent: string
  responseText: string | null
}

async function selectFocusEntries(
  report: RangeReportWithContext,
  sourceEntries: RangeReportSummarySourceEntry[],
  systemPrompt: string,
  settings: AiSettings,
  apiKey: string,
): Promise<FocusSelectionResult> {
  const heuristicSelection = buildHeuristicFocusSelection(report, sourceEntries)

  if (sourceEntries.length <= FULL_CONTEXT_ENTRY_THRESHOLD) {
    return {
      selection: heuristicSelection,
      userContent: '',
      responseText: null,
    }
  }

  const userContent = buildFocusSelectionPrompt(report, sourceEntries)
  const availableDates = new Set(sourceEntries.map((entry) => entry.date))

  try {
    const responseText = await withAiRetry(
      (timeoutMs) => createAiChatClient(settings, apiKey, timeoutMs),
      (client) =>
        client.completeJson({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      { minTimeoutMs: Math.max(settings.timeoutMs, FOCUS_TIMEOUT_FLOOR_MS), label: '焦点日期选择' },
    )

    const normalizedSelection = normalizeFocusSelection(
      extractJsonObject<FocusSelectionPayload>(responseText),
      availableDates,
    )

    return {
      selection: normalizedSelection.length > 0 ? normalizedSelection : heuristicSelection,
      userContent,
      responseText,
    }
  } catch {
    return {
      selection: heuristicSelection,
      userContent,
      responseText: null,
    }
  }
}

export async function generateRangeReportSummaryWithAi(
  report: RangeReport,
  sourceEntries: RangeReportSummarySourceEntry[],
  workspacePath: string,
) {
  const [config, focusPrompt, summaryPrompt, supplement, userProfile] = await Promise.all([
    readAppConfig(),
    loadPrompt('rangeReportSummaryFocusSystem'),
    loadPrompt('rangeReportSummarySystem'),
    readSupplement(workspacePath),
    readUserProfileContext(workspacePath),
  ])
  const settings = ensureAiSettingsReady(config)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先保存当前 provider 的 API Key。')
  }

  const availableEntries = sourceEntries.filter(
    (entry) => entry.body.trim() || entry.summary.trim() || entry.tags.length > 0,
  )

  if (availableEntries.length === 0) {
    throw new Error('当前区间没有可用于总结的日记内容。')
  }

  const reportWithContext = {
    ...report,
    supplement,
    userProfile,
  }
  const { selection: focusSelection, userContent: focusUserContent, responseText: focusResponseText } =
    await selectFocusEntries(reportWithContext, availableEntries, focusPrompt, settings, apiKey)

  const chat = createRangeReportChat(settings, apiKey, summaryPrompt)
  if (focusUserContent && focusResponseText) {
    chat.appendRoundTrip(focusUserContent, focusResponseText)
  }

  const responseText = await chat.send(
    buildSummaryPrompt(reportWithContext, availableEntries, focusSelection, !focusResponseText),
    { thinking: true, label: '区间总结' },
  )

  return normalizeSummaryPayload(
    extractJsonObject<RangeReportSummaryPayload>(responseText),
    new Set(availableEntries.map((entry) => entry.date)),
  )
}
