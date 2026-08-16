import { describe, expect, it } from 'vitest'
import {
  aggregateRecords,
  assertValidAmountCents,
  assertValidDate,
  assertValidNote,
  averageDailyExpense,
  averageMonthlyExpense,
  filterBillsByType,
  formatCents,
  formatPlainCents,
  lastRecordedDateOfMonth,
  pickPaletteColor,
  resolveCategory,
  sliceLatestMonths,
  toBillQueryRecord,
  toCents,
  typeFromAmount,
} from '../../src/shared/bills-logic'
import {
  BUILTIN_CATEGORIES,
  DEFAULT_CATEGORY_PALETTE,
  type Bill,
  type BillCategory,
} from '../../src/types/bills'

const CATEGORIES: BillCategory[] = BUILTIN_CATEGORIES

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

describe('resolveCategory', () => {
  it('matches expense by amount sign first (转账 disambiguation)', () => {
    const result = resolveCategory(CATEGORIES, -5000, '转账')
    expect(result.type).toBe('expense')
    expect(result.fallback).toBe(false)
  })

  it('matches income by amount sign first', () => {
    const result = resolveCategory(CATEGORIES, 5000, '转账')
    expect(result.type).toBe('income')
  })

  it('falls back to name lookup for transfer categories', () => {
    const result = resolveCategory(CATEGORIES, 5000, '理财')
    expect(result.type).toBe('transfer')
  })

  it('falls back to fallback category when name is missing', () => {
    const result = resolveCategory(CATEGORIES, -100, '已删除分类')
    expect(result.type).toBe('expense')
    expect(result.fallback).toBe(true)
    expect(result.color).toBe('#8B948E')
  })

  it('returns fallback colors even when category file lacks fallback entry', () => {
    const empty: BillCategory[] = []
    const result = resolveCategory(empty, 100, '任意')
    expect(result.type).toBe('income')
    expect(result.fallback).toBe(true)
  })
})

describe('aggregateRecords', () => {
  it('sums expense and income, excludes transfer', () => {
    const records = [
      makeBill({ amountCents: -2346, category: '餐饮' }),
      makeBill({ amountCents: -5000, category: '转账' }),
      makeBill({ amountCents: 12000, category: '工资' }),
      makeBill({ amountCents: 5000, category: '转账' }),
      makeBill({ amountCents: -100000, category: '理财' }),
    ]
    const result = aggregateRecords(records, CATEGORIES)
    expect(result.expense).toBe(7346)
    expect(result.income).toBe(17000)
    expect(result.net).toBe(9654)
    expect(result.count).toBe(5)
  })

  it('treats unknown category by amount sign', () => {
    const records = [makeBill({ amountCents: -100, category: '已删除分类' })]
    const result = aggregateRecords(records, CATEGORIES)
    expect(result.expense).toBe(100)
    expect(result.income).toBe(0)
  })
})

describe('filterBillsByType', () => {
  const records = [
    makeBill({ id: 1, amountCents: -2346, category: '餐饮' }),
    makeBill({ id: 2, amountCents: -5000, category: '转账' }),
    makeBill({ id: 3, amountCents: 12000, category: '工资' }),
    makeBill({ id: 4, amountCents: 5000, category: '转账' }),
    makeBill({ id: 5, amountCents: -100000, category: '理财' }),
  ]

  it('filters expense by resolved category (sign disambiguation)', () => {
    const result = filterBillsByType(records, 'expense', CATEGORIES)
    expect(result.map((record) => record.id)).toEqual([1, 2])
  })

  it('filters income by resolved category', () => {
    const result = filterBillsByType(records, 'income', CATEGORIES)
    expect(result.map((record) => record.id)).toEqual([3, 4])
  })

  it('filters transfer by name lookup', () => {
    const result = filterBillsByType(records, 'transfer', CATEGORIES)
    expect(result.map((record) => record.id)).toEqual([5])
  })

  it('returns empty when no record matches', () => {
    const result = filterBillsByType([], 'expense', CATEGORIES)
    expect(result).toEqual([])
  })
})

describe('lastRecordedDateOfMonth', () => {
  it('returns the latest recorded date within the month', () => {
    const records = [
      makeBill({ id: 1, date: '2026-07-15' }),
      makeBill({ id: 2, date: '2026-07-31' }),
      makeBill({ id: 3, date: '2026-07-02' }),
      makeBill({ id: 4, date: '2026-08-01' }),
    ]
    expect(lastRecordedDateOfMonth(records, '2026', '07')).toBe('2026-07-31')
  })

  it('returns null when the month has no records', () => {
    const records = [makeBill({ id: 1, date: '2026-06-30' }), makeBill({ id: 2, date: '2026-08-01' })]
    expect(lastRecordedDateOfMonth(records, '2026', '07')).toBeNull()
  })

  it('returns null for empty records', () => {
    expect(lastRecordedDateOfMonth([], '2026', '07')).toBeNull()
  })
})

describe('toBillQueryRecord', () => {
  it('converts cents to yuan amount alongside facts', () => {
    const record = toBillQueryRecord(makeBill({ id: 7, amountCents: -3550, category: '餐饮', note: '午饭' }))
    expect(record).toEqual({
      id: 7,
      date: '2026-08-01',
      amountCents: -3550,
      amount: -35.5,
      category: '餐饮',
      note: '午饭',
    })
  })

  it('keeps positive amounts for income', () => {
    const record = toBillQueryRecord(makeBill({ amountCents: 12000 }))
    expect(record.amount).toBe(120)
  })
})

describe('formatCents', () => {
  it('formats signed two decimals', () => {
    expect(formatCents(-2346)).toBe('-23.46')
    expect(formatCents(12000)).toBe('+120.00')
    expect(formatCents(0)).toBe('+0.00')
  })
})

describe('toCents', () => {
  it('converts yuan to cents', () => {
    expect(toCents(23.46)).toBe(2346)
    expect(toCents(0.1)).toBe(10)
    expect(toCents(-5)).toBe(-500)
  })
})

describe('pickPaletteColor', () => {
  it('returns first unused palette color', () => {
    const used = new Set(['#6E9C9C', '#7A9BAE'])
    expect(pickPaletteColor(used)).toBe('#8A7FA8')
  })

  it('falls back to last color when palette exhausted', () => {
    const used = new Set(DEFAULT_CATEGORY_PALETTE)
    expect(pickPaletteColor(used)).toBe(DEFAULT_CATEGORY_PALETTE[DEFAULT_CATEGORY_PALETTE.length - 1])
  })
})

describe('assertValidDate', () => {
  it('accepts valid dates', () => {
    expect(() => assertValidDate('2026-08-01')).not.toThrow()
    expect(() => assertValidDate('2024-02-29')).not.toThrow()
  })

  it('rejects impossible calendar dates like 2026-02-31', () => {
    expect(() => assertValidDate('2026-02-31')).toThrow()
  })

  it('rejects out-of-range months like 2026-13-01', () => {
    expect(() => assertValidDate('2026-13-01')).toThrow()
  })

  it('rejects malformed formats like 2026/08/01', () => {
    expect(() => assertValidDate('2026/08/01')).toThrow()
    expect(() => assertValidDate('20260801')).toThrow()
  })
})

describe('assertValidAmountCents', () => {
  it('rejects zero', () => {
    expect(() => assertValidAmountCents(0)).toThrow()
  })

  it('rejects non-integer amounts', () => {
    expect(() => assertValidAmountCents(12.5)).toThrow()
  })

  it('rejects amounts beyond the upper bound', () => {
    expect(() => assertValidAmountCents(1000000000)).toThrow()
  })

  it('accepts valid amounts', () => {
    expect(() => assertValidAmountCents(-2346)).not.toThrow()
  })
})

describe('assertValidNote', () => {
  it('accepts notes up to 200 characters', () => {
    expect(() => assertValidNote('长'.repeat(200))).not.toThrow()
  })

  it('rejects notes longer than 200 characters', () => {
    expect(() => assertValidNote('长'.repeat(201))).toThrow()
  })
})

describe('typeFromAmount', () => {
  it('maps negative amounts to expense', () => {
    expect(typeFromAmount(-1)).toBe('expense')
  })

  it('maps positive amounts to income', () => {
    expect(typeFromAmount(1)).toBe('income')
  })
})

describe('formatPlainCents', () => {
  it('formats plain two decimals without sign', () => {
    expect(formatPlainCents(-2346)).toBe('23.46')
    expect(formatPlainCents(12000)).toBe('120.00')
  })
})

describe('sliceLatestMonths', () => {
  function makeBills(dates: string[]): Bill[] {
    return dates.map((date, index) => makeBill({ id: index + 1, date }))
  }

  it('keeps only the latest month when records span multiple months', () => {
    const records = makeBills(['2025-12-31', '2025-12-01', '2025-11-15', '2025-10-01'])
    const result = sliceLatestMonths(records, 1)
    expect(result.map((record) => record.id)).toEqual([1, 2])
  })

  it('keeps latest months across year boundary', () => {
    const records = makeBills(['2026-01-10', '2025-12-20', '2025-11-05'])
    const result = sliceLatestMonths(records, 2)
    expect(result.map((record) => record.id)).toEqual([1, 2])
  })

  it('returns everything when month count exceeds available months', () => {
    const records = makeBills(['2025-12-31', '2025-11-15'])
    const result = sliceLatestMonths(records, 3)
    expect(result).toEqual(records)
  })

  it('returns everything when month count matches exactly', () => {
    const records = makeBills(['2025-12-31', '2025-11-15'])
    const result = sliceLatestMonths(records, 2)
    expect(result).toEqual(records)
  })

  it('returns empty array for empty input', () => {
    expect(sliceLatestMonths([], 3)).toEqual([])
  })

  it('returns empty array for zero month count', () => {
    const records = makeBills(['2025-12-31'])
    expect(sliceLatestMonths(records, 0)).toEqual([])
  })

  it('preserves input order within kept records', () => {
    const records = makeBills(['2025-12-30', '2025-12-01', '2025-11-30'])
    const result = sliceLatestMonths(records, 1)
    expect(result.map((record) => record.date)).toEqual(['2025-12-30', '2025-12-01'])
  })
})

describe('averageDailyExpense', () => {
  it('divides by natural days of the month', () => {
    expect(averageDailyExpense(30000, 2026, 6)).toBe(1000)
    expect(averageDailyExpense(31000, 2026, 1)).toBe(1000)
  })

  it('handles leap year February (29 days)', () => {
    expect(averageDailyExpense(29000, 2028, 2)).toBe(1000)
  })

  it('handles non-leap February (28 days)', () => {
    expect(averageDailyExpense(28000, 2026, 2)).toBe(1000)
  })

  it('rounds to the nearest cent', () => {
    expect(averageDailyExpense(30001, 2026, 6)).toBe(1000)
  })

  it('returns zero for no expense', () => {
    expect(averageDailyExpense(0, 2026, 6)).toBe(0)
  })
})

describe('averageMonthlyExpense', () => {
  it('divides by twelve months', () => {
    expect(averageMonthlyExpense(12000)).toBe(1000)
  })

  it('rounds to the nearest cent', () => {
    expect(averageMonthlyExpense(12500)).toBe(1042)
  })

  it('returns zero for no expense', () => {
    expect(averageMonthlyExpense(0)).toBe(0)
  })
})
