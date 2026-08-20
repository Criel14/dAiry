import { describe, expect, it } from 'vitest'
import {
  buildDailyAxis,
  buildMonthWindow,
  buildYearWindow,
  expenseTotal,
  filterBillsByMonth,
  incomeTotal,
  isLeapYear,
} from '../../src/shared/bills-logic'
import { BUILTIN_CATEGORIES, type Bill } from '../../src/types/bills'

const CATEGORIES = BUILTIN_CATEGORIES

function makeBill(overrides: Partial<Bill>): Bill {
  return {
    id: 1,
    date: '2026-08-01',
    amountCents: -2346,
    category: '餐饮',
    note: '',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildMonthWindow', () => {
  it('returns current month and previous months in ascending order', () => {
    expect(buildMonthWindow('2026-08', 6)).toEqual([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ])
  })

  it('crosses year boundary', () => {
    expect(buildMonthWindow('2026-01', 6)).toEqual([
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
    ])
  })

  it('handles count of one', () => {
    expect(buildMonthWindow('2026-08', 1)).toEqual(['2026-08'])
  })
})

describe('buildYearWindow', () => {
  it('returns current year and previous years in ascending order', () => {
    expect(buildYearWindow('2026', 6)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026'])
  })

  it('handles count of one', () => {
    expect(buildYearWindow('2026', 1)).toEqual(['2026'])
  })
})

describe('expenseTotal', () => {
  it('sums only expense records, excludes income and transfer', () => {
    const records = [
      makeBill({ amountCents: -2346, category: '餐饮' }),
      makeBill({ amountCents: 12000, category: '工资' }),
      makeBill({ amountCents: -100000, category: '理财' }),
    ]
    expect(expenseTotal(records, CATEGORIES)).toBe(2346)
  })

  it('returns 0 when no expense', () => {
    const records = [makeBill({ amountCents: 12000, category: '工资' })]
    expect(expenseTotal(records, CATEGORIES)).toBe(0)
  })
})

describe('incomeTotal', () => {
  it('sums income records, excludes transfer category 理财 and expense', () => {
    const records = [
      makeBill({ amountCents: 12000, category: '工资' }),
      makeBill({ amountCents: 5000, category: '转账' }),
      makeBill({ amountCents: -2346, category: '餐饮' }),
      makeBill({ amountCents: 3000, category: '理财' }),
    ]
    expect(incomeTotal(records, CATEGORIES)).toBe(17000)
  })

  it('returns 0 when no income', () => {
    const records = [makeBill({ amountCents: -500 })]
    expect(incomeTotal(records, CATEGORIES)).toBe(0)
  })
})

describe('filterBillsByMonth', () => {
  it('keeps only records of the given month', () => {
    const records = [
      makeBill({ date: '2026-08-01' }),
      makeBill({ date: '2026-08-20' }),
      makeBill({ date: '2026-01-05' }),
    ]
    const result = filterBillsByMonth(records, '08')
    expect(result.map((r) => r.date)).toEqual(['2026-08-01', '2026-08-20'])
  })

  it('returns empty array when no match', () => {
    expect(filterBillsByMonth([makeBill({ date: '2026-01-05' })], '08')).toEqual([])
  })
})

describe('isLeapYear', () => {
  it('detects leap years', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
  })
})

describe('buildDailyAxis', () => {
  it('returns 365 dates for a common year', () => {
    const dates = buildDailyAxis(2026)
    expect(dates).toHaveLength(365)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates[364]).toBe('2026-12-31')
  })

  it('returns 366 dates for a leap year', () => {
    expect(buildDailyAxis(2024)).toHaveLength(366)
    expect(buildDailyAxis(2024).at(59)).toBe('2024-02-29')
  })
})
