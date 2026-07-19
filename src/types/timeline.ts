export interface TimelineEvent {
  id: string
  date: string
  dateEnd: string | null
  title: string
  summary: string
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
