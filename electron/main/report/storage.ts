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
} from '../workspace/paths'

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

  const report = rawValue as Partial<RangeReport>
  const period = report.period as Partial<RangeReport['period']> | undefined

  if (typeof report.reportId !== 'string' || !report.reportId) {
    throw new Error('报告文件缺少 reportId，可能已损坏。')
  }

  if (!period || typeof period.label !== 'string' || !period.label) {
    throw new Error('报告文件缺少 period 信息，可能已损坏。')
  }

  if (typeof report.summary?.text !== 'string' || !report.summary.text) {
    throw new Error('报告文件缺少总结内容，可能已损坏。')
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
  for (const filePath of filePaths) {
    try {
      return await readReportFile(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      if (error instanceof SyntaxError) {
        throw new Error('报告文件内容无法解析，可能已损坏。')
      }

      throw error
    }
  }

  throw new Error('报告不存在。')
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
