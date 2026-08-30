import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TimelineEvent, TimelineYearData } from '../../../src/types/timeline'
import { resolveTimelineDirPath } from '../workspace/paths'

export function getTimelineFilePath(workspacePath: string, year: number): string {
  return join(resolveTimelineDirPath(workspacePath), `${year}.json`)
}

// 旧版本数据可能带 dateEnd 字段（时间段事件），读取时统一剥离，
// 旧事件自动降级为以 date 为准的时间点事件，无需迁移脚本。
export function stripLegacyDateEnd(event: TimelineEvent): TimelineEvent {
  const { dateEnd, ...rest } = event as TimelineEvent & { dateEnd?: unknown }
  return rest
}

export function readTimelineYear(workspacePath: string, year: number): TimelineYearData | null {
  const filePath = getTimelineFilePath(workspacePath, year)

  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as TimelineYearData
  return {
    ...data,
    events: data.events.map(stripLegacyDateEnd),
  }
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

// 单日事件 upsert：同一天已有事件则覆盖 title/detail（保留原 id），
// 否则新增一条 id 固定为 evt_{YYYYMMDD}_001 的时间点事件。
// 约定一天最多一个事件；若旧数据中同一天存在多条重复事件，仅第一条会被更新。
export function upsertEventForDate(
  events: TimelineEvent[],
  date: string,
  draft: { title: string; detail: string },
): { events: TimelineEvent[]; created: boolean } {
  const index = events.findIndex((e) => e.date === date)

  if (index !== -1) {
    const next = [...events]
    next[index] = {
      ...next[index],
      title: draft.title,
      detail: draft.detail,
    }
    return { events: next, created: false }
  }

  const id = `evt_${date.replace(/-/g, '')}_001`
  return {
    events: [
      ...events,
      {
        id,
        date,
        title: draft.title,
        detail: draft.detail,
        diaryDates: [date],
      },
    ],
    created: true,
  }
}
