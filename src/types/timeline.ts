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
