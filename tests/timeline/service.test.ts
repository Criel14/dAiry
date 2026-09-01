import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from '../../src/types/timeline'
import {
  addManualEvent,
  mergeEvents,
  normalizeBatchEvents,
  removeTimelineEvent,
  stripLegacyDateEnd,
  updateTimelineEvent,
  upsertEventForDate,
} from '../../electron/main/timeline/service'

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'evt_20260315_001',
    date: '2026-03-15',
    title: '完成项目文档',
    detail: '写完文档并通过评审。',
    diaryDates: ['2026-03-15'],
    ...overrides,
  }
}

describe('stripLegacyDateEnd', () => {
  it('removes legacy dateEnd field from old events', () => {
    const legacy = {
      ...makeEvent(),
      dateEnd: '2026-03-20',
    } as TimelineEvent & { dateEnd?: unknown }

    const result = stripLegacyDateEnd(legacy)

    expect(result).not.toHaveProperty('dateEnd')
    expect(result.date).toBe('2026-03-15')
  })

  it('removes legacy dateEnd field when it is null', () => {
    const legacy = {
      ...makeEvent(),
      dateEnd: null,
    } as TimelineEvent & { dateEnd?: unknown }

    const result = stripLegacyDateEnd(legacy)

    expect(result).not.toHaveProperty('dateEnd')
    expect(result).toEqual(makeEvent())
  })
})

describe('upsertEventForDate', () => {
  it('creates a new event with stable id when date has no event', () => {
    const result = upsertEventForDate([], '2026-03-15', {
      title: '完成项目文档',
      detail: '写完并通过评审。',
    })

    expect(result.created).toBe(true)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toEqual({
      id: 'evt_20260315_001',
      date: '2026-03-15',
      title: '完成项目文档',
      detail: '写完并通过评审。',
      diaryDates: ['2026-03-15'],
    })
  })

  it('updates title and detail of existing event and keeps id', () => {
    const existing = [makeEvent({ id: 'evt_20260315_001', title: '旧标题' })]

    const result = upsertEventForDate(existing, '2026-03-15', {
      title: '新标题',
      detail: '新详情',
    })

    expect(result.created).toBe(false)
    expect(result.events[0].id).toBe('evt_20260315_001')
    expect(result.events[0].title).toBe('新标题')
    expect(result.events[0].detail).toBe('新详情')
    expect(existing).toHaveLength(1)
    expect(existing[0].title).toBe('旧标题')
  })
})

describe('normalizeBatchEvents', () => {
  it('creates events with main-process generated ids and diaryDates', () => {
    const result = normalizeBatchEvents([
      { date: '2026-03-15', title: '完成项目文档', detail: '写完文档并通过评审。' },
      { date: '2026-03-20', title: '公司周年庆活动', detail: '下午全员参加。' },
    ])

    expect(result).toEqual([
      {
        id: 'evt_20260315_001',
        date: '2026-03-15',
        title: '完成项目文档',
        detail: '写完文档并通过评审。',
        diaryDates: ['2026-03-15'],
      },
      {
        id: 'evt_20260320_001',
        date: '2026-03-20',
        title: '公司周年庆活动',
        detail: '下午全员参加。',
        diaryDates: ['2026-03-20'],
      },
    ])
  })

  it('keeps only the last event when the same date appears multiple times', () => {
    const result = normalizeBatchEvents([
      { date: '2026-03-15', title: '旧事件', detail: '旧详情' },
      { date: '2026-03-15', title: '新事件', detail: '新详情' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('新事件')
    expect(result[0].detail).toBe('新详情')
    expect(result[0].id).toBe('evt_20260315_001')
  })

  it('returns empty array for empty input', () => {
    expect(normalizeBatchEvents([])).toEqual([])
  })
})

describe('addManualEvent', () => {
  it('creates a new event with main-process id and diaryDates when date is free', () => {
    const result = addManualEvent([], {
      date: '2026-04-01',
      title: '手动新增事件',
      detail: '手动补充的记录。',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event).toEqual({
        id: 'evt_20260401_001',
        date: '2026-04-01',
        title: '手动新增事件',
        detail: '手动补充的记录。',
        diaryDates: ['2026-04-01'],
      })
      expect(result.events).toHaveLength(1)
    }
  })

  it('rejects with conflict reason when date already has an event', () => {
    const existing = [makeEvent({ date: '2026-03-15' })]

    const result = addManualEvent(existing, {
      date: '2026-03-15',
      title: '冲突事件',
      detail: '不应该成功。',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('conflict')
    }
    expect(existing).toHaveLength(1)
    expect(existing[0].title).toBe('完成项目文档')
  })
})

describe('updateTimelineEvent', () => {
  it('updates title, detail and date, keeping id and syncing diaryDates', () => {
    const existing = [makeEvent({ id: 'evt_20260315_001' })]

    const result = updateTimelineEvent(existing, {
      id: 'evt_20260315_001',
      date: '2026-03-16',
      title: '新标题',
      detail: '新详情',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event).toEqual({
        id: 'evt_20260315_001',
        date: '2026-03-16',
        title: '新标题',
        detail: '新详情',
        diaryDates: ['2026-03-16'],
      })
    }
    expect(existing[0].date).toBe('2026-03-15')
  })

  it('rejects with conflict when new date belongs to another event', () => {
    const existing = [
      makeEvent({ id: 'evt_20260315_001', date: '2026-03-15' }),
      makeEvent({ id: 'evt_20260320_001', date: '2026-03-20' }),
    ]

    const result = updateTimelineEvent(existing, {
      id: 'evt_20260315_001',
      date: '2026-03-20',
      title: '新标题',
      detail: '新详情',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('conflict')
    }
  })

  it('allows keeping the same date when updating an event', () => {
    const existing = [makeEvent({ id: 'evt_20260315_001', date: '2026-03-15' })]

    const result = updateTimelineEvent(existing, {
      id: 'evt_20260315_001',
      date: '2026-03-15',
      title: '同一日期新标题',
      detail: '同一日期新详情',
    })

    expect(result.ok).toBe(true)
  })

  it('returns not-found when id does not exist', () => {
    const result = updateTimelineEvent([makeEvent()], {
      id: 'evt_missing_001',
      date: '2026-03-15',
      title: 'x',
      detail: 'y',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('not-found')
    }
  })
})

describe('removeTimelineEvent', () => {
  it('removes the event by id and keeps the rest', () => {
    const existing = [
      makeEvent({ id: 'evt_20260315_001' }),
      makeEvent({ id: 'evt_20260320_001', date: '2026-03-20' }),
    ]

    const result = removeTimelineEvent(existing, 'evt_20260315_001')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.events).toHaveLength(1)
      expect(result.events[0].id).toBe('evt_20260320_001')
    }
    expect(existing).toHaveLength(2)
  })

  it('returns not-found when id does not exist', () => {
    const existing = [makeEvent()]

    const result = removeTimelineEvent(existing, 'evt_missing_001')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('not-found')
    }
  })
})

describe('mergeEvents', () => {
  it('deduplicates by id with incoming overriding existing', () => {
    const existing = [makeEvent({ id: 'a', title: '旧' })]
    const incoming = [
      makeEvent({ id: 'a', title: '新' }),
      makeEvent({ id: 'b' }),
    ]

    const merged = mergeEvents(existing, incoming)

    expect(merged).toHaveLength(2)
    expect(merged.find((e) => e.id === 'a')?.title).toBe('新')
  })
})
