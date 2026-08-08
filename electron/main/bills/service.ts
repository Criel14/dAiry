import type {
  Bill,
  BillCategory,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsListMonthInput,
  BillsListYearInput,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsUpdateInput,
} from '../../../src/types/bills'
import {
  createBillCategory,
  deleteBillCategory,
  getBillCategories,
  renameBillCategory,
} from './categories'
import { getBillsDatabase, mapRowToBill } from './db'
import { assertValidAmountCents, assertValidDate, assertValidNote, resolveCategory } from './logic'

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

  const db = getBillsDatabase(input.workspacePath)
  const rows = db
    .prepare('SELECT * FROM bills WHERE date LIKE ? ORDER BY date ASC, id ASC')
    .all(`${input.month}-%`) as import('./db').BillRow[]
  return rows.map(mapRowToBill)
}

export async function listBillsByYear(input: BillsListYearInput): Promise<Bill[]> {
  if (!/^\d{4}$/.test(input.year)) {
    throw new Error('年份格式无效，必须为 YYYY。')
  }

  const db = getBillsDatabase(input.workspacePath)
  const rows = db
    .prepare('SELECT * FROM bills WHERE date LIKE ? ORDER BY date ASC, id ASC')
    .all(`${input.year}-%`) as import('./db').BillRow[]
  return rows.map(mapRowToBill)
}

export async function getAllBills(workspacePath: string): Promise<Bill[]> {
  const db = getBillsDatabase(workspacePath)
  const rows = db.prepare('SELECT * FROM bills ORDER BY date ASC, id ASC').all() as import('./db').BillRow[]
  return rows.map(mapRowToBill)
}

export async function createBill(input: BillsRecordInput): Promise<Bill> {
  const { categories, date, amountCents, note } = await normalizeRecordInput(input)
  assertCategoryExists(categories, amountCents, input.category)

  const db = getBillsDatabase(input.workspacePath)
  const timestamp = nowIso()
  const result = db
    .prepare('INSERT INTO bills (date, amount_cents, category, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(date, amountCents, input.category, note, timestamp, timestamp)

  const row = db
    .prepare('SELECT * FROM bills WHERE id = ?')
    .get(result.lastInsertRowid) as import('./db').BillRow
  return mapRowToBill(row)
}

export async function updateBill(input: BillsUpdateInput): Promise<Bill> {
  const { categories, date, amountCents, note } = await normalizeRecordInput(input)
  assertCategoryExists(categories, amountCents, input.category)

  const db = getBillsDatabase(input.workspacePath)
  const existing = db.prepare('SELECT id FROM bills WHERE id = ?').get(input.id)
  if (!existing) {
    throw new Error('账单记录不存在或已被删除。')
  }

  db.prepare(
    'UPDATE bills SET date = ?, amount_cents = ?, category = ?, note = ?, updated_at = ? WHERE id = ?',
  ).run(date, amountCents, input.category, note, nowIso(), input.id)

  const row = db.prepare('SELECT * FROM bills WHERE id = ?').get(input.id) as import('./db').BillRow
  return mapRowToBill(row)
}

export async function deleteBill(input: BillsDeleteInput): Promise<void> {
  const db = getBillsDatabase(input.workspacePath)
  db.prepare('DELETE FROM bills WHERE id = ?').run(input.id)
}

export function createCategory(input: BillsCreateCategoryInput) {
  return createBillCategory(input.workspacePath, input.type, input.name)
}

export function updateCategory(input: BillsRenameCategoryInput) {
  return renameBillCategory(input.workspacePath, input.type, input.name, input.newName)
}

export function removeCategory(input: BillsDeleteCategoryInput) {
  return deleteBillCategory(input.workspacePath, input.type, input.name)
}

export { getBillCategories as listBillCategories }
