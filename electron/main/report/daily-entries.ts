import { type Dayjs } from 'dayjs'
import type { ReportDailyEntry } from '../../../src/types/report'
import { ensureDailyInsights, getRecentDailySummaries } from '../ai'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { countJournalWords, readJournalDocument, writeJournalDocument } from '../journal/document'
import { updateJournalMetaEntry } from '../journal/meta-index'
import { getWorkspaceTags } from '../workspace/libraries'
import { resolveJournalEntryFilePath } from '../workspace/paths'
import { listDatesInRange } from './range'

export interface DailyEntryBuildResult {
  entry: ReportDailyEntry
  body: string
}

const INSIGHT_CONCURRENCY = 5

/** 元索引是整文件读改写，回填时串行化避免并发竞争 */
let metaIndexWriteQueue: Promise<void> = Promise.resolve()

function enqueueMetaIndexWrite(task: () => Promise<void>): Promise<void> {
  const result = metaIndexWriteQueue.then(task, task)
  metaIndexWriteQueue = result.catch(() => undefined)
  return result
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await task(items[index])
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

function getWritingHour(createdAt: string | null, updatedAt: string | null) {
  const primaryTime = createdAt ? new Date(createdAt) : null
  if (primaryTime && !Number.isNaN(primaryTime.getTime())) {
    return primaryTime.getHours()
  }

  const fallbackTime = updatedAt ? new Date(updatedAt) : null
  return fallbackTime && !Number.isNaN(fallbackTime.getTime()) ? fallbackTime.getHours() : null
}

export async function buildDailyEntries(
  workspacePath: string,
  startDate: Dayjs,
  endDate: Dayjs,
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
  return input.entry.hasEntry && input.entry.summary.trim() === '' && input.body.trim() !== ''
}

/** 补做成功后回填 frontmatter 并同步元索引；回填失败不影响报告生成 */
async function backfillEntryInsight(
  workspacePath: string,
  date: string,
  insight: { summary: string; tags: string[]; mood: number },
): Promise<void> {
  const filePath = resolveJournalEntryFilePath(workspacePath, date)
  const document = await readJournalDocument(filePath)

  const frontmatter = {
    ...document.frontmatter,
    mood: insight.mood,
    summary: insight.summary,
    tags: [...insight.tags],
    updatedAt: new Date().toISOString(),
  }

  await writeJournalDocument(filePath, frontmatter, document.body)
  await enqueueMetaIndexWrite(() =>
    updateJournalMetaEntry(workspacePath, date, frontmatter, document.body),
  )
}

export async function hydrateMissingDailyInsights(
  workspacePath: string,
  dailyEntryResults: DailyEntryBuildResult[],
) {
  const warnings: string[] = []
  const workspaceTags = await getWorkspaceTags(workspacePath).catch(() => [])
  let reusedEntryInsightCount = 0
  let generatedEntryInsightCount = 0
  let attemptedGeneration = false

  const candidates: DailyEntryBuildResult[] = []

  for (const dailyEntryResult of dailyEntryResults) {
    const { entry } = dailyEntryResult

    if (!entry.hasEntry) {
      continue
    }

    if (!shouldGenerateEntryInsight(dailyEntryResult)) {
      if (entry.summary.trim()) {
        reusedEntryInsightCount += 1
      }
      continue
    }

    candidates.push(dailyEntryResult)
  }

  if (candidates.length > 0) {
    attemptedGeneration = true
    const config = await readAppConfig()
    const settings = normalizeAiSettings(config.ai)
    const latestDate = candidates.reduce((latest, item) =>
      item.entry.date > latest ? item.entry.date : latest,
    candidates[0].entry.date)
    const recentSummaries = await getRecentDailySummaries(
      workspacePath,
      latestDate,
      settings.dailyContextDays,
    )

    const generatedByDate = new Map<string, ReportDailyEntry>()

    await runWithConcurrency(candidates, INSIGHT_CONCURRENCY, async (dailyEntryResult) => {
      const { entry, body } = dailyEntryResult

      try {
        const generatedInsight = await ensureDailyInsights({
          workspacePath,
          date: entry.date,
          body,
          workspaceTags,
          currentSummary: entry.summary,
          currentTags: entry.tags,
          currentMood: entry.mood ?? 0,
          recentSummaries,
        })

        try {
          await backfillEntryInsight(workspacePath, entry.date, generatedInsight)
        } catch (backfillError) {
          const message =
            backfillError instanceof Error ? backfillError.message : '未知错误'
          warnings.push(`${entry.date} 的日级整理结果回填失败：${message}`)
        }

        generatedEntryInsightCount += 1
        generatedByDate.set(entry.date, {
          ...entry,
          summary: generatedInsight.summary,
          tags: generatedInsight.tags,
          mood: generatedInsight.mood,
          insightSource: 'generated',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        warnings.push(`${entry.date} 的日级整理未生成：${message}`)
        generatedByDate.set(entry.date, entry)
      }
    })

    const nextEntries: ReportDailyEntry[] = dailyEntryResults.map((item) => {
      if (item.entry.hasEntry && generatedByDate.has(item.entry.date)) {
        return generatedByDate.get(item.entry.date) ?? item.entry
      }

      return item.entry
    })

    return {
      dailyEntries: nextEntries,
      warnings,
      reusedEntryInsightCount,
      generatedEntryInsightCount,
      entryInsightPolicy: attemptedGeneration ? 'reuse-or-generate' : 'reuse-only',
    } as const
  }

  return {
    dailyEntries: dailyEntryResults.map((item) => item.entry),
    warnings,
    reusedEntryInsightCount,
    generatedEntryInsightCount,
    entryInsightPolicy: attemptedGeneration ? 'reuse-or-generate' : 'reuse-only',
  } as const
}
