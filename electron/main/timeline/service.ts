import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TimelineEvent, TimelineYearData } from '../../../src/types/timeline'
import { resolveTimelineDirPath } from '../workspace/paths'

export function getTimelineFilePath(workspacePath: string, year: number): string {
  return join(resolveTimelineDirPath(workspacePath), `${year}.json`)
}

export function readTimelineYear(workspacePath: string, year: number): TimelineYearData | null {
  const filePath = getTimelineFilePath(workspacePath, year)

  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as TimelineYearData
}

export function writeTimelineYear(workspacePath: string, data: TimelineYearData): void {
  const dirPath = resolveTimelineDirPath(workspacePath)

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }

  const filePath = getTimelineFilePath(workspacePath, data.year)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function mergeEvents(existing: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
  const eventMap = new Map<string, TimelineEvent>()

  for (const event of existing) {
    eventMap.set(event.id, event)
  }

  for (const event of incoming) {
    eventMap.set(event.id, event)
  }

  return Array.from(eventMap.values())
}
