import type {
  GenerateRangeReportInput,
  RangeReport,
  ReportListItem,
  ReportQuery,
} from '../../../src/types/report'
import { buildDailyEntries, hydrateMissingDailyInsights } from './daily-entries'
import {
  buildEmptyReportMessage,
  formatReportLabel,
  getReportTimezone,
  resolveTargetReportId,
  validateReportRange,
} from './range'
import { buildSections, buildSourceSummary } from './sections'
import {
  getReportFilePath,
  listAllReportFiles,
  mapReportListItem,
  readReportFile,
  readReportWithFallback,
  resolveReportPathCandidates,
  writeReport,
} from './storage'
import { buildFallbackSummary, buildReportSummary, buildSummarySourceEntries } from './summary'

export async function generateRangeReport(input: GenerateRangeReportInput): Promise<RangeReport> {
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
  const summarySourceEntries = buildSummarySourceEntries(dailyEntryResults, dailyEntries)
  const report: RangeReport = {
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

  report.summary = await buildReportSummary(report, fallbackSummary, summarySourceEntries)

  const filePath = getReportFilePath(input.workspacePath, input.preset, reportId, startDate)
  await writeReport(filePath, report)

  return report
}

export async function getRangeReport(input: ReportQuery): Promise<RangeReport> {
  return readReportWithFallback(resolveReportPathCandidates(input.workspacePath, input.reportId))
}

export async function listRangeReports(workspacePath: string): Promise<ReportListItem[]> {
  if (!workspacePath.trim()) {
    return []
  }

  const reportFiles = await listAllReportFiles(workspacePath)
  const reports = await Promise.all(reportFiles.map(async (filePath) => mapReportListItem(await readReportFile(filePath))))
  const uniqueReports = new Map<string, ReportListItem>()

  for (const report of reports) {
    if (!uniqueReports.has(report.reportId)) {
      uniqueReports.set(report.reportId, report)
    }
  }

  return [...uniqueReports.values()].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt),
  )
}
