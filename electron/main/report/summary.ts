import type { RangeReport, RangeReportSummary } from '../../../src/types/report'
import {
  generateRangeReportSummaryWithAi,
  type RangeReportSummarySourceEntry,
} from '../ai'
import type { DailyEntryBuildResult } from './daily-entries'
import { buildTagCloudItems } from './sections'

interface ReportSourceSummary {
  entryDays: number
  missingDays: number
  totalWords: number
  longestStreak: number
}

export function buildFallbackSummary(
  label: string,
  source: ReportSourceSummary,
  dailyEntries: RangeReport['dailyEntries'],
): RangeReportSummary {
  const topTags = buildTagCloudItems(dailyEntries)
    .slice(0, 3)
    .map((item) => item.label)
  const tagText =
    topTags.length > 0
      ? `主要标签包括 ${topTags.join('、')}。`
      : '这段时间还没有形成明显的标签集中。'

  return {
    text: `${label}共记录 ${source.entryDays} 天，缺失 ${source.missingDays} 天，总字数 ${source.totalWords}，最长连续记录 ${source.longestStreak} 天。${tagText}`,
    progress:
      source.entryDays > 0
        ? [
            {
              text: `完成了 ${source.entryDays} 天记录，累计写下 ${source.totalWords} 字。`,
              timeAnchor: {
                type: 'approx',
                label: '整个区间',
              },
            },
          ]
        : [],
    blockers: [],
    memorableMoments: [],
  }
}

export function buildSummarySourceEntries(
  dailyEntryResults: DailyEntryBuildResult[],
  dailyEntries: RangeReport['dailyEntries'],
) {
  const hydratedEntryMap = new Map(dailyEntries.map((entry) => [entry.date, entry]))

  return dailyEntryResults
    .map((result): RangeReportSummarySourceEntry | null => {
      const hydratedEntry = hydratedEntryMap.get(result.entry.date)
      if (!hydratedEntry || !hydratedEntry.hasEntry) {
        return null
      }

      return {
        date: hydratedEntry.date,
        body: result.body,
        summary: hydratedEntry.summary,
        tags: [...hydratedEntry.tags],
        mood: hydratedEntry.mood,
        wordCount: hydratedEntry.wordCount,
        location: hydratedEntry.location,
        insightSource: hydratedEntry.insightSource,
      }
    })
    .filter((entry): entry is RangeReportSummarySourceEntry => Boolean(entry))
}

export async function buildReportSummary(
  draftReport: RangeReport,
  fallbackSummary: RangeReportSummary,
  sourceEntries: RangeReportSummarySourceEntry[],
) {
  try {
    return await generateRangeReportSummaryWithAi(draftReport, sourceEntries)
  } catch (error) {
    const message = error instanceof Error ? error.message : '区间总结 AI 生成失败。'
    draftReport.generation.warnings.push(`AI 总结未生成：${message}`)
    return fallbackSummary
  }
}
