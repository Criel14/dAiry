import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from '../../src/types/timeline'
import {
  mergeEvents,
  stripLegacyDateEnd,
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
