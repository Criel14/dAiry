import { describe, expect, it } from 'vitest'
import {
  BILLS_SEARCH_PAGE_SIZE,
  aggregateRecords,
  applyCategoryRenameToBill,
  billMatchesKeyword,
  billSearchContribution,
  splitNoteByKeyword,
} from '../../src/shared/bills-logic'
import { BUILTIN_CATEGORIES, type Bill, type BillCategory } from '../../src/types/bills'

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

describe('billMatchesKeyword', () => {
  it('matches Chinese substring', () => {
    expect(billMatchesKeyword('楼下买了手撕鸡', '手撕鸡')).toBe(true)
  })

  it('matches ASCII case-insensitively', () => {
    expect(billMatchesKeyword('MOUse 蓝牙版', 'mouse')).toBe(true)
    expect(billMatchesKeyword('mouse', 'MOUSE')).toBe(true)
  })

  it('returns false for empty keyword or empty note', () => {
    expect(billMatchesKeyword('鼠标', '')).toBe(false)
    expect(billMatchesKeyword('', '鼠标')).toBe(false)
  })

  it('treats % _ \\ as literal characters (mirrors escaped LIKE)', () => {
    expect(billMatchesKeyword('折扣100%', '100%')).toBe(true)
    expect(billMatchesKeyword('折扣1000', '100%')).toBe(false)
    expect(billMatchesKeyword('a_b', 'a_b')).toBe(true)
    expect(billMatchesKeyword('axb', 'a_b')).toBe(false)
    expect(billMatchesKeyword('C:\\tools', 'c:\\tools')).toBe(true)
  })
})

describe('splitNoteByKeyword', () => {
  it('splits a single hit into before/hit/after segments', () => {
    expect(splitNoteByKeyword('买了个鼠标垫', '鼠标')).toEqual([
      { text: '买了个', hit: false },
      { text: '鼠标', hit: true },
      { text: '垫', hit: false },
    ])
  })

  it('splits every occurrence', () => {
    expect(splitNoteByKeyword('鼠标和鼠标垫', '鼠标')).toEqual([
      { text: '鼠标', hit: true },
      { text: '和', hit: false },
      { text: '鼠标', hit: true },
      { text: '垫', hit: false },
    ])
  })

  it('keeps original casing while matching case-insensitively', () => {
    expect(splitNoteByKeyword('Mouse mouse', 'MOUSE')).toEqual([
      { text: 'Mouse', hit: true },
      { text: ' ', hit: false },
      { text: 'mouse', hit: true },
    ])
  })

  it('returns one non-hit segment when keyword is empty or nothing matches', () => {
    expect(splitNoteByKeyword('随便写点', '')).toEqual([{ text: '随便写点', hit: false }])
    expect(splitNoteByKeyword('随便写点', '手撕鸡')).toEqual([{ text: '随便写点', hit: false }])
    expect(splitNoteByKeyword('', '鼠标')).toEqual([{ text: '', hit: false }])
  })
})

describe('billSearchContribution', () => {
  it('counts expense and income by sign', () => {
    expect(billSearchContribution(CATEGORIES, makeBill({ amountCents: -5000 }))).toEqual({
      income: 0,
      expense: 5000,
    })
    expect(
      billSearchContribution(CATEGORIES, makeBill({ amountCents: 8000, category: '工资' })),
    ).toEqual({ income: 8000, expense: 0 })
  })

  it('excludes transfer records', () => {
    expect(
      billSearchContribution(CATEGORIES, makeBill({ amountCents: -100000, category: '理财' })),
    ).toEqual({ income: 0, expense: 0 })
  })

  it('falls back by sign when the category no longer exists', () => {
    expect(
      billSearchContribution(CATEGORIES, makeBill({ amountCents: -1200, category: '已删分类' })),
    ).toEqual({ income: 0, expense: 1200 })
  })

  it('sums to the same totals as aggregateRecords', () => {
    const bills = [
      makeBill({ id: 1, amountCents: -5000, category: '餐饮' }),
      makeBill({ id: 2, amountCents: 30000, category: '工资' }),
      makeBill({ id: 3, amountCents: -200000, category: '理财' }),
      makeBill({ id: 4, amountCents: -800, category: '已删分类' }),
    ]
    const sum = bills.reduce(
      (acc, bill) => {
        const part = billSearchContribution(CATEGORIES, bill)
        return { income: acc.income + part.income, expense: acc.expense + part.expense }
      },
      { income: 0, expense: 0 },
    )
    const aggregate = aggregateRecords(bills, CATEGORIES)
    expect(sum).toEqual({ income: aggregate.income, expense: aggregate.expense })
  })
})

describe('applyCategoryRenameToBill', () => {
  it('renames transfer records regardless of sign', () => {
    const rename = { type: 'transfer' as const, oldName: '基金', newName: '理财基金' }
    expect(
      applyCategoryRenameToBill(makeBill({ category: '基金', amountCents: -100 }), rename).category,
    ).toBe('理财基金')
    expect(
      applyCategoryRenameToBill(makeBill({ category: '基金', amountCents: 100 }), rename).category,
    ).toBe('理财基金')
  })

  it('renames expense records only when amount is negative', () => {
    const rename = { type: 'expense' as const, oldName: '咖啡', newName: '饮品' }
    expect(
      applyCategoryRenameToBill(makeBill({ category: '咖啡', amountCents: -100 }), rename).category,
    ).toBe('饮品')
    expect(
      applyCategoryRenameToBill(makeBill({ category: '咖啡', amountCents: 100 }), rename).category,
    ).toBe('咖啡')
  })

  it('renames income records only when amount is positive', () => {
    const rename = { type: 'income' as const, oldName: '外快', newName: '奖金' }
    expect(
      applyCategoryRenameToBill(makeBill({ category: '外快', amountCents: 100 }), rename).category,
    ).toBe('奖金')
    expect(
      applyCategoryRenameToBill(makeBill({ category: '外快', amountCents: -100 }), rename).category,
    ).toBe('外快')
  })

  it('returns the original record when the name does not match', () => {
    const bill = makeBill({ category: '餐饮' })
    const rename = { type: 'expense' as const, oldName: '咖啡', newName: '饮品' }
    expect(applyCategoryRenameToBill(bill, rename)).toBe(bill)
  })
})

describe('BILLS_SEARCH_PAGE_SIZE', () => {
  it('is 30', () => {
    expect(BILLS_SEARCH_PAGE_SIZE).toBe(30)
  })
})
