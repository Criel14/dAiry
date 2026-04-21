import { type Dayjs } from 'dayjs'
import type { ReportDailyEntry } from '../../../src/types/report'
import { ensureDailyInsights } from '../ai'
import { countJournalWords, readJournalDocument } from '../journal-document'
import { getWorkspaceTags } from '../workspace-libraries'
import { resolveJournalEntryFilePath } from '../workspace-paths'
import { listDatesInRange } from './range'

export interface DailyEntryBuildResult {
  entry: ReportDailyEntry
  body: string
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

export async function hydrateMissingDailyInsights(
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
