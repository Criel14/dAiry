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
