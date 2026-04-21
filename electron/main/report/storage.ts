import path from 'node:path'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { type Dayjs } from 'dayjs'
import type { RangeReport, ReportListItem, ReportPreset } from '../../../src/types/report'
import {
  getLegacyWorkspaceCustomReportsDir,
  getLegacyWorkspaceMonthlyReportsDir,
  getLegacyWorkspaceYearlyReportsDir,
  getWorkspaceCustomReportsDir,
  getWorkspaceMonthlyReportsDir,
  getWorkspaceYearlyReportsDir,
  resolveCustomReportPath,
  resolveLegacyCustomReportPath,
  resolveLegacyMonthlyReportPath,
  resolveLegacyYearlyReportPath,
  resolveMonthlyReportPath,
  resolveYearlyReportPath,
} from '../workspace-paths'

export function getReportFilePath(
  workspacePath: string,
  preset: ReportPreset,
  reportId: string,
  startDate: Dayjs,
) {
  if (preset === 'month') {
    return resolveMonthlyReportPath(workspacePath, startDate.format('YYYY-MM'))
  }

  if (preset === 'year') {
    return resolveYearlyReportPath(workspacePath, startDate.format('YYYY'))
  }

  return resolveCustomReportPath(workspacePath, reportId)
}

export async function writeReport(filePath: string, report: RangeReport) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8')
}

function normalizeReport(rawValue: unknown): RangeReport {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('报告文件内容无效。')
  }

  return rawValue as RangeReport
}

export async function readReportFile(filePath: string) {
  const fileContent = await readFile(filePath, 'utf-8')
  return normalizeReport(JSON.parse(fileContent))
}

export async function listReportFiles(targetDir: string) {
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

export function resolveReportPathCandidates(workspacePath: string, reportId: string) {
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

export async function readReportWithFallback(filePaths: string[]) {
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

export async function listAllReportFiles(workspacePath: string) {
  const [
    monthlyFiles,
    yearlyFiles,
    customFiles,
    legacyMonthlyFiles,
    legacyYearlyFiles,
    legacyCustomFiles,
  ] = await Promise.all([
    listReportFiles(getWorkspaceMonthlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceYearlyReportsDir(workspacePath)),
    listReportFiles(getWorkspaceCustomReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceMonthlyReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceYearlyReportsDir(workspacePath)),
    listReportFiles(getLegacyWorkspaceCustomReportsDir(workspacePath)),
  ])

  return [
    ...monthlyFiles,
    ...yearlyFiles,
    ...customFiles,
    ...legacyMonthlyFiles,
    ...legacyYearlyFiles,
    ...legacyCustomFiles,
  ]
}

export function mapReportListItem(report: RangeReport): ReportListItem {
  return {
    reportId: report.reportId,
    preset: report.preset,
    label: report.period.label,
    startDate: report.period.startDate,
    endDate: report.period.endDate,
    generatedAt: report.period.generatedAt,
    summaryText: report.summary.text,
  }
}
