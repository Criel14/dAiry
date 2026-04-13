import path from 'node:path'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import dayjs from 'dayjs'
import type {
  GenerateRangeReportInput,
  RangeReport,
  RangeReportSummary,
  ReportDailyEntry,
  ReportHighlightEvent,
  ReportListItem,
  ReportQuery,
  ReportSectionKey,
  ReportSections,
  ReportStatsSection,
  ReportTagCloudItem,
} from '../../src/types/dairy'
import { ensureDailyInsights, generateRangeReportSummaryWithAi } from './ai'
import { countJournalWords, readJournalDocument } from './journal-document'
import { getWorkspaceTags } from './workspace-libraries'
import {
  assertValidDate,
  assertValidMonth,
  assertValidYear,
  resolveCustomReportPath,
  resolveLegacyCustomReportPath,
  resolveJournalEntryFilePath,
  resolveLegacyMonthlyReportPath,
  resolveLegacyYearlyReportPath,
  resolveMonthlyReportPath,
  resolveYearlyReportPath,
  getWorkspaceCustomReportsDir,
  getLegacyWorkspaceCustomReportsDir,
  getLegacyWorkspaceMonthlyReportsDir,
  getLegacyWorkspaceYearlyReportsDir,
  getWorkspaceMonthlyReportsDir,
  getWorkspaceYearlyReportsDir,
} from './workspace-paths'

interface DailyEntryBuildResult {
  entry: ReportDailyEntry
  body: string
}

function normalizeRequestedSections(sections: ReportSectionKey[]) {
  const allowedSections: ReportSectionKey[] = [
    'stats',
    'heatmap',
    'moodTrend',
    'tagCloud',
    'highlights',
    'locationPatterns',
    'timePatterns',
  ]
  const uniqueSections = new Set<ReportSectionKey>()

  for (const section of sections) {
    if (allowedSections.includes(section)) {
      uniqueSections.add(section)
    }
  }

  return uniqueSections.size > 0 ? [...uniqueSections] : allowedSections
}

function validateReportRange(input: GenerateRangeReportInput) {
  if (!input.workspacePath.trim()) {
    throw new Error('当前还没有可用的工作区。')
  }

  assertValidDate(input.startDate)
  assertValidDate(input.endDate)

  const startDate = dayjs(input.startDate)
  const endDate = dayjs(input.endDate)

  if (!startDate.isValid() || !endDate.isValid()) {
    throw new Error('报告区间无效。')
  }

  if (endDate.isBefore(startDate, 'day')) {
    throw new Error('结束日期不能早于开始日期。')
  }

  if (input.preset === 'month') {
    const monthKey = startDate.format('YYYY-MM')
    assertValidMonth(monthKey)

    if (
      !startDate.isSame(startDate.startOf('month'), 'day') ||
      !endDate.isSame(startDate.endOf('month'), 'day')
    ) {
      throw new Error('月度报告的区间必须覆盖完整自然月。')
    }
  }

  if (input.preset === 'year') {
    const yearKey = startDate.format('YYYY')
    assertValidYear(yearKey)

    if (
      !startDate.isSame(startDate.startOf('year'), 'day') ||
      !endDate.isSame(startDate.endOf('year'), 'day')
    ) {
      throw new Error('年度报告的区间必须覆盖完整自然年。')
    }
  }

  return {
    startDate,
    endDate,
    requestedSections: normalizeRequestedSections(input.requestedSections),
  }
}

function listDatesInRange(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) {
  const dates: string[] = []
  let currentDate = startDate.startOf('day')

  while (currentDate.isSame(endDate, 'day') || currentDate.isBefore(endDate, 'day')) {
    dates.push(currentDate.format('YYYY-MM-DD'))
    currentDate = currentDate.add(1, 'day')
  }

  return dates
}

function getWritingHour(createdAt: string | null, updatedAt: string | null) {
  const primaryTime = createdAt ? dayjs(createdAt) : null
  if (primaryTime?.isValid()) {
    return primaryTime.hour()
  }

  const fallbackTime = updatedAt ? dayjs(updatedAt) : null
  return fallbackTime?.isValid() ? fallbackTime.hour() : null
}

async function buildDailyEntries(
  workspacePath: string,
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
) {
  const dates = listDatesInRange(startDate, endDate)

  return Promise.all(
    dates.map(async (date): Promise<DailyEntryBuildResult> => {
      const filePath = resolveJournalEntryFilePath(workspacePath, date)

      try {
        const document = await readJournalDocument(filePath)
        const createdAt = document.frontmatter.createdAt || null
        const updatedAt = document.frontmatter.updatedAt || null

        return {
          entry: {
            date,
            hasEntry: true,
            wordCount: countJournalWords(document.body),
            mood: document.frontmatter.mood,
            summary: document.frontmatter.summary,
            tags: [...document.frontmatter.tags],
            location: document.frontmatter.location,
            createdAt,
            updatedAt,
            writingHour: getWritingHour(createdAt, updatedAt),
            insightSource: 'frontmatter',
          },
          body: document.body,
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            entry: {
              date,
              hasEntry: false,
              wordCount: 0,
              mood: null,
              summary: '',
              tags: [],
              location: '',
              createdAt: null,
              updatedAt: null,
              writingHour: null,
              insightSource: 'missing',
            },
            body: '',
          }
        }

        throw error
      }
    }),
  )
}

function shouldGenerateEntryInsight(input: DailyEntryBuildResult) {
  return (
    input.entry.hasEntry &&
    input.entry.summary.trim() === '' &&
    input.body.trim() !== ''
  )
}

async function hydrateMissingDailyInsights(
  workspacePath: string,
  dailyEntryResults: DailyEntryBuildResult[],
) {
  const warnings: string[] = []
  const workspaceTags = await getWorkspaceTags(workspacePath).catch(() => [])
  let reusedEntryInsightCount = 0
  let generatedEntryInsightCount = 0
  let attemptedGeneration = false

  const nextEntries: ReportDailyEntry[] = []

  for (const dailyEntryResult of dailyEntryResults) {
    const { entry, body } = dailyEntryResult

    if (!entry.hasEntry) {
      nextEntries.push(entry)
      continue
    }

    if (!shouldGenerateEntryInsight(dailyEntryResult)) {
      if (entry.summary.trim()) {
        reusedEntryInsightCount += 1
      }

      nextEntries.push(entry)
      continue
    }

    attemptedGeneration = true

    try {
      const generatedInsight = await ensureDailyInsights({
        workspacePath,
        date: entry.date,
        body,
        workspaceTags,
        currentSummary: entry.summary,
        currentTags: entry.tags,
        currentMood: entry.mood ?? 0,
      })

      generatedEntryInsightCount += 1
      nextEntries.push({
        ...entry,
        summary: generatedInsight.summary,
        tags: generatedInsight.tags,
        mood: generatedInsight.mood,
        insightSource: 'generated',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      warnings.push(`${entry.date} 的日级整理未生成：${message}`)
      nextEntries.push(entry)
    }
  }

  return {
    dailyEntries: nextEntries,
    warnings,
    reusedEntryInsightCount,
    generatedEntryInsightCount,
    entryInsightPolicy: attemptedGeneration ? 'reuse-or-generate' : 'reuse-only',
  } as const
}

function countLongestStreak(dailyEntries: ReportDailyEntry[]) {
  let longestStreak = 0
  let currentStreak = 0

  for (const entry of dailyEntries) {
    if (entry.hasEntry) {
      currentStreak += 1
      longestStreak = Math.max(longestStreak, currentStreak)
      continue
    }

    currentStreak = 0
  }

  return longestStreak
}

function countCurrentStreakAtEnd(dailyEntries: ReportDailyEntry[]) {
  let streak = 0

  for (let index = dailyEntries.length - 1; index >= 0; index -= 1) {
    if (!dailyEntries[index].hasEntry) {
      break
    }

    streak += 1
  }

  return streak
}

function buildSourceSummary(dailyEntries: ReportDailyEntry[]) {
  const entryDays = dailyEntries.filter((entry) => entry.hasEntry)
  const totalWords = entryDays.reduce((sum, entry) => sum + entry.wordCount, 0)

  return {
    totalDays: dailyEntries.length,
    entryDays: entryDays.length,
    missingDays: dailyEntries.length - entryDays.length,
    totalWords,
    averageWords: entryDays.length > 0 ? Math.round(totalWords / entryDays.length) : 0,
    longestStreak: countLongestStreak(dailyEntries),
  }
}

function buildStatsSection(dailyEntries: ReportDailyEntry[]): ReportStatsSection {
  const source = buildSourceSummary(dailyEntries)
  const maxWordEntry = dailyEntries
    .filter((entry) => entry.hasEntry)
    .reduce<ReportDailyEntry | null>((maxEntry, entry) => {
      if (!maxEntry || entry.wordCount > maxEntry.wordCount) {
        return entry
      }

      return maxEntry
    }, null)

  return {
    recordDays: source.entryDays,
    missingDays: source.missingDays,
    totalWords: source.totalWords,
    averageWords: source.averageWords,
    maxWordsInOneDay: maxWordEntry?.wordCount ?? 0,
    maxWordsDate: maxWordEntry?.date ?? null,
    longestStreak: source.longestStreak,
    currentStreakAtEnd: countCurrentStreakAtEnd(dailyEntries),
  }
}

function buildTagCloudItems(dailyEntries: ReportDailyEntry[]): ReportTagCloudItem[] {
  const tagCounter = new Map<string, number>()

  for (const entry of dailyEntries) {
    for (const tag of entry.tags) {
      tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1)
    }
  }

  return [...tagCounter.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'zh-Hans-CN'))
    .slice(0, 30)
}

function createHighlightTitle(summary: string) {
  const normalizedSummary = summary.trim()
  if (!normalizedSummary) {
    return '值得记住的一天'
  }

  return normalizedSummary.length > 18 ? `${normalizedSummary.slice(0, 18)}...` : normalizedSummary
}

function buildHighlightsSection(dailyEntries: ReportDailyEntry[]) {
  const maxWordCount = Math.max(...dailyEntries.map((entry) => entry.wordCount), 1)
  const candidateEntries = dailyEntries.filter(
    (entry) => entry.hasEntry && (entry.summary.trim() || entry.tags.length > 0 || entry.wordCount > 0),
  )

  const events = candidateEntries
    .map<ReportHighlightEvent>((entry) => {
      const moodWeight = entry.mood === null ? 0 : Math.min(Math.abs(entry.mood) / 5, 1)
      const wordWeight = Math.min(entry.wordCount / maxWordCount, 1)
      const tagWeight = Math.min(entry.tags.length / 5, 1)
      const summaryWeight = entry.summary.trim() ? 0.15 : 0
      const score = Number(
        Math.min(0.3 + wordWeight * 0.35 + moodWeight * 0.25 + tagWeight * 0.15 + summaryWeight, 0.99).toFixed(2),
      )

      return {
        date: entry.date,
        title: createHighlightTitle(entry.summary || entry.tags[0] || entry.date),
        summary: entry.summary.trim() || `这一天记录了 ${entry.wordCount} 字内容。`,
        tags: entry.tags.slice(0, 4),
        score,
      }
    })
    .sort((left, right) => right.score - left.score || right.date.localeCompare(left.date))
    .slice(0, 5)

  return {
    events,
  }
}

function buildLocationPatternsSection(dailyEntries: ReportDailyEntry[]) {
  const locationMap = new Map<string, { count: number; totalWords: number }>()

  for (const entry of dailyEntries) {
    if (!entry.hasEntry || !entry.location.trim()) {
      continue
    }

    const location = entry.location.trim()
    const currentValue = locationMap.get(location) ?? { count: 0, totalWords: 0 }
    locationMap.set(location, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount,
    })
  }

  const ranking = [...locationMap.entries()]
    .map(([name, value]) => ({
      name,
      count: value.count,
      totalWords: value.totalWords,
    }))
    .sort((left, right) => right.count - left.count || right.totalWords - left.totalWords)

  const topLocation = ranking[0]
    ? {
        name: ranking[0].name,
        count: ranking[0].count,
      }
    : null

  const maxAverageWords = Math.max(
    ...ranking.map((item) => item.totalWords / item.count),
    1,
  )
  const uniqueCandidate = ranking.reduce<{
    name: string
    count: number
    score: number
    reason: string
  } | null>((best, item) => {
    const rarityScore = 1 / item.count
    const averageWords = item.totalWords / item.count
    const intensityScore = averageWords / maxAverageWords
    const score = Number((rarityScore * 0.62 + intensityScore * 0.38).toFixed(2))
    const reason = `这个地点在区间内出现 ${item.count} 次，频次相对少，但相关记录平均篇幅较高。`

    if (!best || score > best.score) {
      return {
        name: item.name,
        count: item.count,
        score,
        reason,
      }
    }

    return best
  }, null)

  return {
    topLocation,
    uniqueLocation: uniqueCandidate
      ? {
          name: uniqueCandidate.name,
          countInRange: uniqueCandidate.count,
          score: uniqueCandidate.score,
          reason: uniqueCandidate.reason,
        }
      : null,
    ranking: ranking.map((item) => ({
      name: item.name,
      count: item.count,
    })),
  }
}

function getTimeBucketLabel(hour: number) {
  if (hour >= 0 && hour <= 5) {
    return '凌晨 0-5'
  }

  if (hour <= 8) {
    return '早晨 6-8'
  }

  if (hour <= 11) {
    return '上午 9-11'
  }

  if (hour <= 13) {
    return '中午 12-13'
  }

  if (hour <= 17) {
    return '下午 14-17'
  }

  return '晚上 18-23'
}

function buildTimePatternsSection(dailyEntries: ReportDailyEntry[]) {
  const bucketMap = new Map<string, { count: number; totalWords: number }>()

  for (const entry of dailyEntries) {
    if (!entry.hasEntry || entry.writingHour === null) {
      continue
    }

    const bucketLabel = getTimeBucketLabel(entry.writingHour)
    const currentValue = bucketMap.get(bucketLabel) ?? { count: 0, totalWords: 0 }
    bucketMap.set(bucketLabel, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount,
    })
  }

  const buckets = [...bucketMap.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      totalWords: value.totalWords,
    }))
    .sort((left, right) => right.count - left.count || right.totalWords - left.totalWords)

  const topTimeBucket = buckets[0]
    ? {
        label: buckets[0].label,
        count: buckets[0].count,
      }
    : null

  const maxAverageWords = Math.max(...buckets.map((item) => item.totalWords / item.count), 1)
  const uniqueCandidate = buckets.reduce<{
    label: string
    count: number
    score: number
    reason: string
  } | null>((best, item) => {
    const rarityScore = 1 / item.count
    const intensityScore = item.totalWords / item.count / maxAverageWords
    const score = Number((rarityScore * 0.58 + intensityScore * 0.42).toFixed(2))
    const reason = `这个时间段出现 ${item.count} 次，虽然不是最高频，但相关记录的平均篇幅更突出。`

    if (!best || score > best.score) {
      return {
        label: item.label,
        count: item.count,
        score,
        reason,
      }
    }

    return best
  }, null)

  return {
    topTimeBucket,
    uniqueTimeBucket: uniqueCandidate
      ? {
          label: uniqueCandidate.label,
          countInRange: uniqueCandidate.count,
          score: uniqueCandidate.score,
          reason: uniqueCandidate.reason,
        }
      : null,
    buckets: buckets.map((item) => ({
      label: item.label,
      count: item.count,
    })),
  }
}

function buildSections(
  dailyEntries: ReportDailyEntry[],
  requestedSections: ReportSectionKey[],
): ReportSections {
  const sections: ReportSections = {}

  if (requestedSections.includes('stats')) {
    sections.stats = buildStatsSection(dailyEntries)
  }

  if (requestedSections.includes('heatmap')) {
    sections.heatmap = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.wordCount,
      })),
    }
  }

  if (requestedSections.includes('moodTrend')) {
    const moodEntries = dailyEntries.filter((entry) => entry.mood !== null)
    const totalMood = moodEntries.reduce((sum, entry) => sum + (entry.mood ?? 0), 0)

    sections.moodTrend = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.mood,
      })),
      averageMood:
        moodEntries.length > 0
          ? Number((totalMood / moodEntries.length).toFixed(1))
          : null,
    }
  }

  if (requestedSections.includes('tagCloud')) {
    sections.tagCloud = {
      items: buildTagCloudItems(dailyEntries),
    }
  }

  if (requestedSections.includes('highlights')) {
    sections.highlights = buildHighlightsSection(dailyEntries)
  }

  if (requestedSections.includes('locationPatterns')) {
    sections.locationPatterns = buildLocationPatternsSection(dailyEntries)
  }

  if (requestedSections.includes('timePatterns')) {
    sections.timePatterns = buildTimePatternsSection(dailyEntries)
  }

  return sections
}

function formatReportLabel(preset: GenerateRangeReportInput['preset'], startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) {
  if (preset === 'month') {
    return `${startDate.format('YYYY 年 M 月')}总结`
  }

  if (preset === 'year') {
    return `${startDate.format('YYYY 年')}总结`
  }

  return `${startDate.format('YYYY 年 M 月 D 日')} 至 ${endDate.format('YYYY 年 M 月 D 日')}总结`
}

function buildEmptyReportMessage(
  preset: GenerateRangeReportInput['preset'],
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
) {
  if (preset === 'month') {
    return `${startDate.format('YYYY 年 M 月')}还没有任何日记，无法生成报告。`
  }

  if (preset === 'year') {
    return `${startDate.format('YYYY 年')}还没有任何日记，无法生成报告。`
  }

  return `${startDate.format('YYYY-MM-DD')} 至 ${endDate.format('YYYY-MM-DD')} 这段时间还没有任何日记，无法生成报告。`
}

function createReportId(
  preset: GenerateRangeReportInput['preset'],
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
) {
  if (preset === 'month') {
    return `month_${startDate.format('YYYY-MM')}`
  }

  if (preset === 'year') {
    return `year_${startDate.format('YYYY')}`
  }

  return `custom_${startDate.format('YYYY-MM-DD')}_${endDate.format('YYYY-MM-DD')}_${Date.now()}`
}

function resolveTargetReportId(
  input: GenerateRangeReportInput,
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
) {
  if (input.preset === 'custom' && input.overwriteReportId?.trim()) {
    return input.overwriteReportId.trim()
  }

  return createReportId(input.preset, startDate, endDate)
}

function buildFallbackSummary(
  label: string,
  source: ReturnType<typeof buildSourceSummary>,
  dailyEntries: ReportDailyEntry[],
) : RangeReportSummary {
  const topTags = buildTagCloudItems(dailyEntries)
    .slice(0, 3)
    .map((item) => item.label)
  const topLocation = buildLocationPatternsSection(dailyEntries).topLocation
  const topTimeBucket = buildTimePatternsSection(dailyEntries).topTimeBucket
  const tagText = topTags.length > 0 ? `主要标签包括 ${topTags.join('、')}。` : '这段时间还没有形成明显的标签集中。'
  const locationText = topLocation ? `最常出现的地点是 ${topLocation.name}。` : ''
  const timeText = topTimeBucket ? `写作多集中在 ${topTimeBucket.label}。` : ''

  return {
    text: `${label}共记录 ${source.entryDays} 天，缺失 ${source.missingDays} 天，总字数 ${source.totalWords}，最长连续记录 ${source.longestStreak} 天。${tagText}${locationText}${timeText}`,
    themes: topTags,
    progress: source.entryDays > 0 ? [`完成了 ${source.entryDays} 天记录，累计 ${source.totalWords} 字。`] : [],
    blockers: [],
    memorableMoments: [],
  }
}

async function buildReportSummary(
  draftReport: RangeReport,
  fallbackSummary: RangeReportSummary,
) {
  try {
    return await generateRangeReportSummaryWithAi(draftReport)
  } catch (error) {
    const message = error instanceof Error ? error.message : '区间总结 AI 生成失败。'
    draftReport.generation.warnings.push(`AI 总结未生成：${message}`)
    return fallbackSummary
  }
}

function getReportTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
}

function getReportFilePath(
  workspacePath: string,
  preset: GenerateRangeReportInput['preset'],
  reportId: string,
  startDate: dayjs.Dayjs,
) {
  if (preset === 'month') {
    return resolveMonthlyReportPath(workspacePath, startDate.format('YYYY-MM'))
  }

  if (preset === 'year') {
    return resolveYearlyReportPath(workspacePath, startDate.format('YYYY'))
  }

  return resolveCustomReportPath(workspacePath, reportId)
}

async function writeReport(filePath: string, report: RangeReport) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8')
}

function normalizeReport(rawValue: unknown): RangeReport {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('报告文件内容无效。')
  }

  return rawValue as RangeReport
}

async function readReportFile(filePath: string) {
  const fileContent = await readFile(filePath, 'utf-8')
  return normalizeReport(JSON.parse(fileContent))
}

async function listReportFiles(targetDir: string) {
  try {
    const entries = await readdir(targetDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => path.join(targetDir, entry.name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

export async function generateRangeReport(
  input: GenerateRangeReportInput,
): Promise<RangeReport> {
  const { startDate, endDate, requestedSections } = validateReportRange(input)
  const dailyEntryResults = await buildDailyEntries(input.workspacePath, startDate, endDate)
  const hasAnyEntry = dailyEntryResults.some((item) => item.entry.hasEntry)

  if (!hasAnyEntry) {
    throw new Error(buildEmptyReportMessage(input.preset, startDate, endDate))
  }

  const dailyInsightHydration = await hydrateMissingDailyInsights(input.workspacePath, dailyEntryResults)
  const dailyEntries = dailyInsightHydration.dailyEntries
  const source = buildSourceSummary(dailyEntries)
  const label = formatReportLabel(input.preset, startDate, endDate)
  const reportId = resolveTargetReportId(input, startDate, endDate)
  const generatedAt = new Date().toISOString()
  const sections = buildSections(dailyEntries, requestedSections)
  const fallbackSummary = buildFallbackSummary(label, source, dailyEntries)
  const report: RangeReport = {
    version: 1,
    reportId,
    preset: input.preset,
    period: {
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      label,
      generatedAt,
      timezone: getReportTimezone(),
    },
    generation: {
      requestedSections,
      entryInsightPolicy: dailyInsightHydration.entryInsightPolicy,
      reusedEntryInsightCount: dailyInsightHydration.reusedEntryInsightCount,
      generatedEntryInsightCount: dailyInsightHydration.generatedEntryInsightCount,
      skippedEmptyDays: source.missingDays,
      warnings: [...dailyInsightHydration.warnings],
    },
    summary: fallbackSummary,
    source,
    dailyEntries,
    sections,
  }

  report.summary = await buildReportSummary(report, fallbackSummary)

  const filePath = getReportFilePath(input.workspacePath, input.preset, reportId, startDate)
  await writeReport(filePath, report)

  return report
}

function resolveReportPathCandidates(workspacePath: string, reportId: string) {
  if (reportId.startsWith('month_')) {
    const monthText = reportId.slice('month_'.length)
    return [
      resolveMonthlyReportPath(workspacePath, monthText),
      resolveLegacyMonthlyReportPath(workspacePath, monthText),
    ]
  }

  if (reportId.startsWith('year_')) {
    const yearText = reportId.slice('year_'.length)
    return [
      resolveYearlyReportPath(workspacePath, yearText),
      resolveLegacyYearlyReportPath(workspacePath, yearText),
    ]
  }

  return [
    resolveCustomReportPath(workspacePath, reportId),
    resolveLegacyCustomReportPath(workspacePath, reportId),
  ]
}

async function readReportWithFallback(filePaths: string[]) {
  let lastError: unknown = null

  for (const filePath of filePaths) {
    try {
      return await readReportFile(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        lastError = error
        continue
      }

      throw error
    }
  }

  throw lastError ?? new Error('报告不存在。')
}

export async function getRangeReport(input: ReportQuery): Promise<RangeReport> {
  return readReportWithFallback(resolveReportPathCandidates(input.workspacePath, input.reportId))
}

export async function listRangeReports(workspacePath: string): Promise<ReportListItem[]> {
  if (!workspacePath.trim()) {
    return []
  }

  const [monthlyFiles, yearlyFiles, customFiles, legacyMonthlyFiles, legacyYearlyFiles, legacyCustomFiles] = await Promise.all([
    listReportFiles(getWorkspaceMonthlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceYearlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceCustomReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceMonthlyReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceYearlyReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceCustomReportsDir(workspacePath)),
  ])

  const reportFiles = [
    ...monthlyFiles,
    ...yearlyFiles,
    ...customFiles,
    ...legacyMonthlyFiles,
    ...legacyYearlyFiles,
    ...legacyCustomFiles,
  ]

  const reports = await Promise.all(
    reportFiles.map(async (filePath) => {
      const report = await readReportFile(filePath)
      return {
        reportId: report.reportId,
        preset: report.preset,
        label: report.period.label,
        startDate: report.period.startDate,
        endDate: report.period.endDate,
        generatedAt: report.period.generatedAt,
        summaryText: report.summary.text,
      } satisfies ReportListItem
    }),
  )

  const uniqueReports = new Map<string, ReportListItem>()

  for (const report of reports) {
    if (!uniqueReports.has(report.reportId)) {
      uniqueReports.set(report.reportId, report)
    }
  }

  return [...uniqueReports.values()].sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
}
