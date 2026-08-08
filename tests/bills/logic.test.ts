import { describe, expect, it } from 'vitest'
import {
  aggregateRecords,
  assertValidAmountCents,
  assertValidDate,
  assertValidNote,
  formatCents,
  formatPlainCents,
  pickPaletteColor,
  resolveCategory,
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
