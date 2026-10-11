import type {
  Bill,
  BillCategory,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsListMonthInput,
  BillsListMonthsInput,
  BillsListYearInput,
  BillsQueryInput,
  BillsQueryResult,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsSearchInput,
  BillsSearchResult,
  BillsUpdateInput,
} from '../../../src/types/bills'
import {
  createBillCategory,
  deleteBillCategory,
  getBillCategories,
  renameBillCategory,
} from './categories'
import { mapRowToBill, withBillsDatabase, withExistingBillsDatabase } from './db'
import {
  aggregateRecords,
  assertValidAmountCents,
  assertValidDate,
  assertValidNote,
  billSearchContribution,
  filterBillsByType,
  resolveCategory,
  toBillQueryRecord,
} from '../../../src/shared/bills-logic'

function nowIso() {
  return new Date().toISOString()
}

function assertCategoryExists(categories: BillCategory[], amountCents: number, name: string) {
  const resolved = resolveCategory(categories, amountCents, name)
  if (resolved.fallback && !categories.some((c) => c.name === name)) {
    throw new Error(`分类「${name}」不存在。`)
  }
}

async function normalizeRecordInput(input: BillsRecordInput) {
  assertValidDate(input.date)
  assertValidAmountCents(input.amountCents)
  assertValidNote(input.note ?? '')
  const categories = await getBillCategories(input.workspacePath)
  return { categories, date: input.date, amountCents: input.amountCents, note: input.note ?? '' }
}

export async function listBillsByMonth(input: BillsListMonthInput): Promise<Bill[]> {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    throw new Error('月份格式无效，必须为 YYYY-MM。')
  }

  return (
    withExistingBillsDatabase(input.workspacePath, (db) => {
      const rows = db
        .prepare('SELECT * FROM bills WHERE date LIKE ? ORDER BY date DESC, id DESC')
        .all(`${input.month}-%`) as import('./db').BillRow[]
      return rows.map(mapRowToBill)
    }) ?? []
  )
}

export async function listBillsByYear(input: BillsListYearInput): Promise<Bill[]> {
  if (!/^\d{4}$/.test(input.year)) {
    throw new Error('年份格式无效，必须为 YYYY。')
  }

  return (
    withExistingBillsDatabase(input.workspacePath, (db) => {
      const rows = db
        .prepare('SELECT * FROM bills WHERE date LIKE ? ORDER BY date DESC, id DESC')
        .all(`${input.year}-%`) as import('./db').BillRow[]
      return rows.map(mapRowToBill)
    }) ?? []
  )
}

export async function listBillsYears(workspacePath: string): Promise<string[]> {
  return (
    withExistingBillsDatabase(workspacePath, (db) => {
      const rows = db
        .prepare('SELECT DISTINCT substr(date, 1, 4) AS period FROM bills ORDER BY period')
        .all() as Array<{ period: string }>
      return rows.map((row) => row.period)
    }) ?? []
  )
}

export async function listBillsMonthsOfYear(input: BillsListMonthsInput): Promise<string[]> {
  if (!/^\d{4}$/.test(input.year)) {
    throw new Error('年份格式无效，必须为 YYYY。')
  }

  return (
    withExistingBillsDatabase(input.workspacePath, (db) => {
      const rows = db
        .prepare(
          'SELECT DISTINCT substr(date, 1, 7) AS period FROM bills WHERE date LIKE ? ORDER BY period',
        )
        .all(`${input.year}-%`) as Array<{ period: string }>
      return rows.map((row) => row.period)
    }) ?? []
  )
}

export async function getAllBills(workspacePath: string): Promise<Bill[]> {
  return (
    withExistingBillsDatabase(workspacePath, (db) => {
      const rows = db
        .prepare('SELECT * FROM bills ORDER BY date ASC, id ASC')
        .all() as import('./db').BillRow[]
      return rows.map(mapRowToBill)
    }) ?? []
  )
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function expandQueryRange(range: BillsQueryInput['range']): { start: string; end: string } {
  if ('month' in range) {
    const match = /^(\d{4})-(\d{2})$/.exec(range.month)
    if (!match) {
      throw new Error('月份格式无效，必须为 YYYY-MM。')
    }
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) {
      throw new Error('月份格式无效，必须为 YYYY-MM。')
    }
    const days = daysInMonth(year, month)
    return { start: `${range.month}-01`, end: `${range.month}-${String(days).padStart(2, '0')}` }
  }

  if ('year' in range) {
    if (!/^\d{4}$/.test(range.year)) {
      throw new Error('年份格式无效，必须为 YYYY。')
    }
    return {
      start: `${range.year}-01-01`,
      end: `${range.year}-12-31`,
    }
  }

  assertValidDate(range.start)
  assertValidDate(range.end)
  if (range.start > range.end) {
    throw new Error('开始日期不能晚于结束日期。')
  }
  return { start: range.start, end: range.end }
}

function escapeLikeKeyword(keyword: string): string {
  return keyword.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function queryBills(input: BillsQueryInput): Promise<BillsQueryResult> {
  const { start, end } = expandQueryRange(input.range)
  const category = input.category?.trim() || null
  const keyword = input.keyword?.trim() || null
  const type = input.type ?? null

  const rows =
    withExistingBillsDatabase(input.workspacePath, (db) => {
      const conditions: string[] = ['date >= ?', 'date <= ?']
      const params: Array<string | number> = [start, end]
      if (category) {
        conditions.push('category = ?')
        params.push(category)
      }
      if (keyword) {
        conditions.push("note LIKE ? ESCAPE '\\'")
        params.push(`%${escapeLikeKeyword(keyword)}%`)
      }
      return db
        .prepare(`SELECT * FROM bills WHERE ${conditions.join(' AND ')} ORDER BY date ASC, id ASC`)
        .all(...params) as import('./db').BillRow[]
    }) ?? []

  const bills = rows.map(mapRowToBill)
  const categories = await getBillCategories(input.workspacePath)
  const matched = type ? filterBillsByType(bills, type, categories) : bills
  const cents = aggregateRecords(matched, categories)

  return {
    range: { start, end },
    filter: { category, type, keyword },
    summary: {
      income: cents.income / 100,
      expense: cents.expense / 100,
      net: cents.net / 100,
      count: cents.count,
    },
    truncated: matched.length > input.limit,
    limit: input.limit,
    records: matched.slice(0, input.limit).map(toBillQueryRecord),
  }
}

export async function searchBills(input: BillsSearchInput): Promise<BillsSearchResult> {
  const keyword = input.keyword.trim()
  if (!keyword) {
    throw new Error('搜索关键词不能为空。')
  }

  const offset = Math.max(0, Math.floor(input.offset))
  const limit = Math.min(Math.max(1, Math.floor(input.limit)), 100)
  const like = `%${escapeLikeKeyword(keyword)}%`

  const categories = await getBillCategories(input.workspacePath)

  const result = withExistingBillsDatabase(input.workspacePath, (db) => {
    // 1) 全量汇总：流式遍历匹配行，不物化大数组。
    //    iterate 必须在后续查询之前耗尽（for 循环会完整消费）。
    let total = 0
    let income = 0
    let expense = 0
    const summaryRows = db
      .prepare("SELECT * FROM bills WHERE note LIKE ? ESCAPE '\\' ORDER BY date DESC, id DESC")
      .iterate(like)
    for (const row of summaryRows) {
      const contribution = billSearchContribution(categories, mapRowToBill(row as import('./db').BillRow))
      total += 1
      income += contribution.income
      expense += contribution.expense
    }

    // 2) 取页：多取 1 条做探测
    const rows = db
      .prepare(
        "SELECT * FROM bills WHERE note LIKE ? ESCAPE '\\' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?",
      )
      .all(like, limit + 1, offset) as import('./db').BillRow[]
    const records = rows.slice(0, limit).map(mapRowToBill)

    // 3) 日边界对齐：探测条与最后一条同日时，继续补齐该日剩余匹配记录
    let probe = rows.length > limit ? rows[limit] : undefined
    while (probe && records.length > 0 && probe.date === records[records.length - 1].date) {
      records.push(mapRowToBill(probe))
      probe = db
        .prepare(
          "SELECT * FROM bills WHERE note LIKE ? ESCAPE '\\' AND date = ? AND id < ? ORDER BY id DESC LIMIT 1",
        )
        .get(like, probe.date, probe.id) as import('./db').BillRow | undefined
    }

    return { records, total, income, expense }
  })

  return result ?? { records: [], total: 0, income: 0, expense: 0 }
}

export async function createBill(input: BillsRecordInput): Promise<Bill> {
  const { categories, date, amountCents, note } = await normalizeRecordInput(input)
  assertCategoryExists(categories, amountCents, input.category)

  return withBillsDatabase(input.workspacePath, (db) => {
    const timestamp = nowIso()
    const result = db
      .prepare(
        'INSERT INTO bills (date, amount_cents, category, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(date, amountCents, input.category, note, timestamp, timestamp)

    const row = db
      .prepare('SELECT * FROM bills WHERE id = ?')
      .get(result.lastInsertRowid) as import('./db').BillRow
    return mapRowToBill(row)
  })
}

export async function updateBill(input: BillsUpdateInput): Promise<Bill> {
  const { categories, date, amountCents, note } = await normalizeRecordInput(input)
  assertCategoryExists(categories, amountCents, input.category)

  const bill = withExistingBillsDatabase(input.workspacePath, (db) => {
    const existing = db.prepare('SELECT id FROM bills WHERE id = ?').get(input.id)
    if (!existing) {
      throw new Error('账单记录不存在或已被删除。')
    }

    db.prepare(
      'UPDATE bills SET date = ?, amount_cents = ?, category = ?, note = ?, updated_at = ? WHERE id = ?',
    ).run(date, amountCents, input.category, note, nowIso(), input.id)

    const row = db.prepare('SELECT * FROM bills WHERE id = ?').get(input.id) as import('./db').BillRow
    return mapRowToBill(row)
  })
  if (!bill) {
    throw new Error('账单记录不存在或已被删除。')
  }
  return bill
}

export async function deleteBill(input: BillsDeleteInput): Promise<void> {
  withExistingBillsDatabase(input.workspacePath, (db) => {
    db.prepare('DELETE FROM bills WHERE id = ?').run(input.id)
  })
}

export function createCategory(input: BillsCreateCategoryInput) {
  return createBillCategory(input.workspacePath, input.type, input.name)
}

export async function updateCategory(input: BillsRenameCategoryInput) {
  const next = await renameBillCategory(input.workspacePath, input.type, input.name, input.newName)
  withExistingBillsDatabase(input.workspacePath, (db) => {
    const newName = input.newName.trim()
    const timestamp = nowIso()
    if (input.type === 'transfer') {
      db.prepare('UPDATE bills SET category = ?, updated_at = ? WHERE category = ?').run(
        newName,
        timestamp,
        input.name,
      )
    } else {
      const signCondition = input.type === 'expense' ? '< 0' : '> 0'
      db.prepare(
        `UPDATE bills SET category = ?, updated_at = ? WHERE category = ? AND amount_cents ${signCondition}`,
      ).run(newName, timestamp, input.name)
    }
  })
  return next
}

export function removeCategory(input: BillsDeleteCategoryInput) {
  return deleteBillCategory(input.workspacePath, input.type, input.name)
}

export { getBillCategories as listBillCategories }
