export interface TimelineEvent {
  id: string
  date: string
  title: string
  detail: string
  diaryDates: string[]
}

export interface TimelineYearData {
  year: number
  version: number
  generatedAt: string
  events: TimelineEvent[]
}

export interface RebuildTimelineProgress {
  weekLabel: string
  current: number
  total: number
}

export interface AddTimelineDayEventInput {
  workspacePath: string
  date: string
}

export interface AddTimelineDayEventResult {
  recorded: boolean
  reason?: 'empty'
  event?: TimelineEvent
}

export interface CreateTimelineEventInput {
  workspacePath: string
  date: string
  title: string
  detail: string
}

export interface UpdateTimelineEventInput {
  workspacePath: string
  id: string
  date: string
  title: string
  detail: string
}

export interface DeleteTimelineEventInput {
  workspacePath: string
  id: string
}

export interface TimelineEventWriteResult {
  ok: boolean
  reason?: 'conflict' | 'not-found'
  event?: TimelineEvent
}
