import path from 'node:path'
import type { JournalEntryQuery } from '../../src/types/dairy'

export function assertValidDate(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('日期格式无效，必须为 YYYY-MM-DD。')
  }
}

export function assertValidMonth(monthText: string) {
  if (!/^\d{4}-\d{2}$/.test(monthText)) {
    throw new Error('月份格式无效，必须为 YYYY-MM。')
  }
}

export function assertValidYear(yearText: string) {
  if (!/^\d{4}$/.test(yearText)) {
    throw new Error('年份格式无效，必须为 YYYY。')
  }
}

export function resolveJournalEntryFilePath(workspacePath: string, date: string) {
  assertValidDate(date)

  const [year, month] = date.split('-')
  return path.join(workspacePath, 'journal', year, month, `${date}.md`)
}

export function resolveJournalEntryPath({ workspacePath, date }: JournalEntryQuery) {
  return resolveJournalEntryFilePath(workspacePath, date)
}

export function getWorkspaceMetadataDir(workspacePath: string) {
  return path.join(workspacePath, '.dairy')
}

export function getWorkspaceReportsDir(workspacePath: string) {
  return path.join(getWorkspaceMetadataDir(workspacePath), 'reports')
}

export function getWorkspaceMonthlyReportsDir(workspacePath: string) {
  return path.join(getWorkspaceReportsDir(workspacePath), 'monthly')
}

export function getWorkspaceYearlyReportsDir(workspacePath: string) {
  return path.join(getWorkspaceReportsDir(workspacePath), 'yearly')
}

export function getWorkspaceCustomReportsDir(workspacePath: string) {
  return path.join(getWorkspaceReportsDir(workspacePath), 'custom')
}

export function getWorkspaceTagLibraryPath(workspacePath: string) {
  return path.join(getWorkspaceMetadataDir(workspacePath), 'tags.json')
}

export function getWorkspaceWeatherLibraryPath(workspacePath: string) {
  return path.join(getWorkspaceMetadataDir(workspacePath), 'weather.json')
}

export function getWorkspaceLocationLibraryPath(workspacePath: string) {
  return path.join(getWorkspaceMetadataDir(workspacePath), 'locations.json')
}

export function getWorkspaceJournalDir(workspacePath: string) {
  return path.join(workspacePath, 'journal')
}

export function resolveMonthlyReportPath(workspacePath: string, month: string) {
  assertValidMonth(month)
  return path.join(getWorkspaceMonthlyReportsDir(workspacePath), `${month}.json`)
}

export function resolveYearlyReportPath(workspacePath: string, year: string) {
  assertValidYear(year)
  return path.join(getWorkspaceYearlyReportsDir(workspacePath), `${year}.json`)
}

export function resolveCustomReportPath(workspacePath: string, reportId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(reportId)) {
    throw new Error('报告标识无效。')
  }

  return path.join(getWorkspaceCustomReportsDir(workspacePath), `${reportId}.json`)
}
