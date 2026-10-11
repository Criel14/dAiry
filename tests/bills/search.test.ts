import { describe, expect, it } from 'vitest'
import {
  BILLS_SEARCH_PAGE_SIZE,
  aggregateRecords,
  applyBillsMutation,
  applyCategoryRenameToBill,
  billMatchesKeyword,
  billSearchContribution,
  splitNoteByKeyword,
} from '../../src/shared/bills-logic'
import {
  BUILTIN_CATEGORIES,
  type Bill,
  type BillCategory,
  type BillsSearchWindow,
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

function makeWindow(records: Bill[], total: number, income = 0, expense = 0): BillsSearchWindow {
  return { records, total, income, expense }
}

const KEY = '鼠标'

describe('applyBillsMutation', () => {
  it('inserts the first match into an empty window', () => {
    const state = makeWindow([], 0)
    const created = makeBill({ id: 1, date: '2026-08-10', amountCents: -5000, note: '手撕鸡' })

    const result = applyBillsMutation(state, { kind: 'create', bill: created }, CATEGORIES, '手撕鸡')

    expect(result.window.records.map((record) => record.id)).toEqual([1])
    expect(result.window.total).toBe(1)
    expect(result.window.expense).toBe(5000)
    expect(result.needsRefill).toBe(false)
  })

  it('inserts a new matching record at the top and counts it (duplicate)', () => {
    const existing = makeBill({ id: 1, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标垫' })
    const state = makeWindow([existing], 1, 0, 1000)
    const created = makeBill({ id: 2, date: '2026-08-10', amountCents: -5000, category: '购物', note: '新鼠标' })

    const result = applyBillsMutation(state, { kind: 'duplicate', bill: created }, CATEGORIES, KEY)

    expect(result.window.records.map((record) => record.id)).toEqual([2, 1])
    expect(result.window.total).toBe(2)
    expect(result.window.expense).toBe(6000)
    expect(result.window.income).toBe(0)
    expect(result.needsRefill).toBe(false)
  })

  it('keeps stats mirroring the match set when the new record sorts beyond the window tail', () => {
    const tail = makeBill({ id: 9, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标垫' })
    const state = makeWindow([tail], 5, 0, 10000)
    const created = makeBill({ id: 3, date: '2020-01-01', amountCents: -2000, category: '购物', note: '旧鼠标' })

    const result = applyBillsMutation(state, { kind: 'create', bill: created }, CATEGORIES, KEY)

    expect(result.window.records.map((record) => record.id)).toEqual([9])
    expect(result.window.total).toBe(6)
    expect(result.window.expense).toBe(12000)
    expect(result.needsRefill).toBe(false)
  })

  it('ignores a new record that does not match the keyword', () => {
    const state = makeWindow([makeBill({ id: 1, note: '鼠标垫' })], 1, 0, 1000)
    const created = makeBill({ id: 2, note: '机械键盘' })

    const result = applyBillsMutation(state, { kind: 'create', bill: created }, CATEGORIES, KEY)

    expect(result.window.records.map((record) => record.id)).toEqual([1])
    expect(result.window.total).toBe(1)
    expect(result.window.expense).toBe(1000)
    expect(result.needsRefill).toBe(false)
  })

  it('replaces an edited record still inside the window and applies only the contribution delta', () => {
    const top = makeBill({ id: 2, date: '2026-08-10', amountCents: -5000, category: '购物', note: '鼠标' })
    const bottom = makeBill({ id: 1, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标垫' })
    const state = makeWindow([top, bottom], 2, 0, 6000)
    const updated = makeBill({ id: 2, date: '2026-08-03', amountCents: -3000, category: '购物', note: '降价鼠标' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: top, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([2, 1])
    expect(result.window.total).toBe(2)
    expect(result.window.expense).toBe(4000)
    expect(result.needsRefill).toBe(false)
  })

  it('removes an edited record that sorts beyond the window tail but keeps the total', () => {
    const top = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const edited = makeBill({ id: 1, date: '2026-08-01', amountCents: -2000, category: '购物', note: '鼠标' })
    const state = makeWindow([top, edited], 10, 0, 20000)
    const updated = makeBill({ id: 1, date: '2020-01-01', amountCents: -3000, category: '购物', note: '鼠标' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: edited, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([5])
    expect(result.window.total).toBe(10)
    expect(result.window.expense).toBe(21000)
    expect(result.needsRefill).toBe(true)
  })

  it('removes an edited record that no longer matches and decrements the total', () => {
    const top = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const edited = makeBill({ id: 1, date: '2026-08-01', amountCents: -2000, category: '购物', note: '鼠标垫' })
    const state = makeWindow([top, edited], 2, 0, 3000)
    const updated = makeBill({ id: 1, date: '2026-08-01', amountCents: -2000, category: '购物', note: '改成了键盘' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: edited, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([5])
    expect(result.window.total).toBe(1)
    expect(result.window.expense).toBe(1000)
    expect(result.needsRefill).toBe(false)
  })

  it('inserts a matching edited record when its previous version was not in the window (defensive)', () => {
    const shown = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([shown], 3, 0, 9000)
    const previous = makeBill({ id: 7, date: '2026-07-01', amountCents: -4000, category: '购物', note: '鼠标垫' })
    const updated = makeBill({ id: 7, date: '2026-08-09', amountCents: -4000, category: '购物', note: '鼠标垫' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([7, 5])
    expect(result.window.total).toBe(3)
    expect(result.window.expense).toBe(9000)
    expect(result.needsRefill).toBe(false)
  })

  it('decrements stats when a non-displayed record is edited out of the match set (defensive)', () => {
    const shown = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([shown], 3, 0, 9000)
    const previous = makeBill({ id: 7, date: '2026-07-01', amountCents: -4000, category: '购物', note: '鼠标垫' })
    const updated = makeBill({ id: 7, date: '2026-07-01', amountCents: -4000, category: '购物', note: '键盘垫' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([5])
    expect(result.window.total).toBe(2)
    expect(result.window.expense).toBe(5000)
    expect(result.needsRefill).toBe(false)
  })

  it('removes a deleted record, decrements totals and asks for a refill when more remain', () => {
    const first = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const second = makeBill({ id: 1, date: '2026-08-01', amountCents: -2000, category: '购物', note: '鼠标垫' })
    const state = makeWindow([first, second], 10, 0, 12000)

    const result = applyBillsMutation(state, { kind: 'delete', bill: first }, CATEGORIES, KEY)

    expect(result.window.records.map((record) => record.id)).toEqual([1])
    expect(result.window.total).toBe(9)
    expect(result.window.expense).toBe(11000)
    expect(result.needsRefill).toBe(true)
  })

  it('does not ask for a refill when nothing is left to load', () => {
    const only = makeBill({ id: 5, date: '2026-08-05', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([only], 1, 0, 1000)

    const result = applyBillsMutation(state, { kind: 'delete', bill: only }, CATEGORIES, KEY)

    expect(result.window.records).toEqual([])
    expect(result.window.total).toBe(0)
    expect(result.window.expense).toBe(0)
    expect(result.needsRefill).toBe(false)
  })

  it('keeps income and expense untouched when a transfer record is deleted', () => {
    const fund = makeBill({ id: 5, date: '2026-08-05', amountCents: -200000, category: '理财', note: '鼠标基金' })
    const state = makeWindow([fund], 2, 0, 500)

    const result = applyBillsMutation(state, { kind: 'delete', bill: fund }, CATEGORIES, KEY)

    expect(result.window.total).toBe(1)
    expect(result.window.expense).toBe(500)
    expect(result.window.income).toBe(0)
    expect(result.needsRefill).toBe(true)
  })

  it('does not re-insert an edited record when the window emptied and more matches remain', () => {
    const only = makeBill({ id: 1, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([only], 3, 0, 9000)
    const updated = makeBill({ id: 1, date: '2020-01-01', amountCents: -2000, category: '餐饮', note: '鼠标' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: only, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records).toEqual([])
    expect(result.window.total).toBe(3)
    expect(result.window.expense).toBe(10000)
    expect(result.needsRefill).toBe(true)
  })

  it('keeps the edited record when the window held the whole match set', () => {
    const only = makeBill({ id: 1, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([only], 1, 0, 1000)
    const updated = makeBill({ id: 1, date: '2020-01-01', amountCents: -2000, category: '餐饮', note: '鼠标' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: only, bill: updated },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([1])
    expect(result.window.total).toBe(1)
    expect(result.window.expense).toBe(2000)
    expect(result.needsRefill).toBe(false)
  })

  it('does not push a new matching record into an empty window while other matches are unloaded', () => {
    const state = makeWindow([], 2, 0, 5000)
    const created = makeBill({ id: 1, date: '2020-01-01', amountCents: -3000, category: '购物', note: '旧鼠标' })

    const result = applyBillsMutation(state, { kind: 'create', bill: created }, CATEGORIES, KEY)

    expect(result.window.records).toEqual([])
    expect(result.window.total).toBe(3)
    expect(result.window.expense).toBe(8000)
    expect(result.needsRefill).toBe(false)
  })

  it('inserts by same-date id tie-break on create', () => {
    const existing = makeBill({ id: 1, date: '2026-08-01', amountCents: -1000, category: '餐饮', note: '鼠标垫' })
    const state = makeWindow([existing], 2, 0, 7000)
    const created = makeBill({ id: 2, date: '2026-08-01', amountCents: -500, category: '购物', note: '鼠标' })

    const result = applyBillsMutation(state, { kind: 'create', bill: created }, CATEGORIES, KEY)

    expect(result.window.records.map((record) => record.id)).toEqual([2, 1])
    expect(result.window.total).toBe(3)
    expect(result.window.expense).toBe(7500)
    expect(result.needsRefill).toBe(false)
  })

  it('applies income and expense deltas when an edit flips the sign', () => {
    const expense = makeBill({ id: 1, date: '2026-08-01', amountCents: -5000, category: '餐饮', note: '鼠标' })
    const state = makeWindow([expense], 1, 0, 5000)
    const income = makeBill({ id: 1, date: '2026-08-01', amountCents: 3000, category: '工资', note: '鼠标' })

    const result = applyBillsMutation(
      state,
      { kind: 'update', previous: expense, bill: income },
      CATEGORIES,
      KEY,
    )

    expect(result.window.records.map((record) => record.id)).toEqual([1])
    expect(result.window.total).toBe(1)
    expect(result.window.income).toBe(3000)
    expect(result.window.expense).toBe(0)
    expect(result.needsRefill).toBe(false)
  })
})
