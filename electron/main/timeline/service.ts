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

// 批量整理（全量重建）产出归一化：id 由主进程生成（evt_{YYYYMMDD}_001），
// diaryDates 固定为 [date]；按日期去重，同一天重复时取最后一条，一天最多一个。
export function normalizeBatchEvents(
  raw: Array<{ date: string; title: string; detail: string }>,
): TimelineEvent[] {
  const eventMap = new Map<string, TimelineEvent>()

  for (const item of raw) {
    eventMap.set(item.date, {
      id: `evt_${item.date.replace(/-/g, '')}_001`,
      date: item.date,
      title: item.title,
      detail: item.detail,
      diaryDates: [item.date],
    })
  }

  return Array.from(eventMap.values())
}

export type ManualEventWriteResult =
  | { ok: true; events: TimelineEvent[]; event?: TimelineEvent }
  | { ok: false; reason: 'conflict' | 'not-found' }

// 手动新增：同一天已有事件则拒绝（保持"一天最多一个"约定），
// 否则新增一条 id 固定为 evt_{YYYYMMDD}_001 的事件。
export function addManualEvent(
  events: TimelineEvent[],
  draft: { date: string; title: string; detail: string },
): ManualEventWriteResult {
  const conflict = events.some((e) => e.date === draft.date)
  if (conflict) {
    return { ok: false, reason: 'conflict' }
  }

  const event: TimelineEvent = {
    id: `evt_${draft.date.replace(/-/g, '')}_001`,
    date: draft.date,
    title: draft.title,
    detail: draft.detail,
    diaryDates: [draft.date],
  }

  return { ok: true, events: [...events, event], event }
}

// 手动编辑：按 id 定位；改日期时排除自身后检查冲突（同一天最多一个）。
export function updateTimelineEvent(
  events: TimelineEvent[],
  input: { id: string; date: string; title: string; detail: string },
): ManualEventWriteResult {
  const index = events.findIndex((e) => e.id === input.id)
  if (index === -1) {
    return { ok: false, reason: 'not-found' }
  }

  const conflict = events.some(
    (e) => e.id !== input.id && e.date === input.date,
  )
  if (conflict) {
    return { ok: false, reason: 'conflict' }
  }

  const next = [...events]
  const event: TimelineEvent = {
    ...next[index],
    date: input.date,
    title: input.title,
    detail: input.detail,
    diaryDates: [input.date],
  }
  next[index] = event

  return { ok: true, events: next, event }
}

// 手动删除：按 id 移除，未找到返回 not-found。
export function removeTimelineEvent(
  events: TimelineEvent[],
  id: string,
): ManualEventWriteResult {
  const index = events.findIndex((e) => e.id === id)
  if (index === -1) {
    return { ok: false, reason: 'not-found' }
  }

  const next = [...events]
  next.splice(index, 1)

  return { ok: true, events: next }
}
