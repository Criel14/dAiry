import {
  DEFAULT_CATEGORY_PALETTE,
  FALLBACK_CATEGORY_NAME,
  type Bill,
  type BillCategory,
  type BillQueryRecord,
  type BillType,
  type BillsSearchMutation,
  type BillsSearchWindow,
} from '../types/bills'

export interface ResolvedCategory {
  type: BillType
  color: string
  icon: string
  fallback: boolean
}

const FALLBACK_COLORS: Record<BillType, string> = {
  expense: '#8B948E',
  income: '#8B948E',
  transfer: '#8B948E',
}

const FALLBACK_ICON = 'ellipsis'

export function typeFromAmount(amountCents: number): BillType {
  return amountCents < 0 ? 'expense' : 'income'
}

export function resolveCategory(
  categories: BillCategory[],
  amountCents: number,
  name: string,
): ResolvedCategory {
  const signType = typeFromAmount(amountCents)

  const bySignAndName = categories.find((c) => c.type === signType && c.name === name)
  if (bySignAndName) {
    return { type: bySignAndName.type, color: bySignAndName.color, icon: bySignAndName.icon, fallback: false }
  }

  const byName = categories.find((c) => c.name === name)
  if (byName) {
    return { type: byName.type, color: byName.color, icon: byName.icon, fallback: false }
  }

  const fallback = categories.find((c) => c.type === signType && c.name === FALLBACK_CATEGORY_NAME)
  if (fallback) {
    return { type: fallback.type, color: fallback.color, icon: fallback.icon, fallback: true }
  }

  return {
    type: signType,
    color: FALLBACK_COLORS[signType],
    icon: FALLBACK_ICON,
    fallback: true,
  }
}

export interface BillAggregate {
  income: number
  expense: number
  net: number
  count: number
}

export function aggregateRecords(records: Bill[], categories: BillCategory[]): BillAggregate {
  let income = 0
  let expense = 0

  for (const record of records) {
    const resolved = resolveCategory(categories, record.amountCents, record.category)
    if (resolved.type === 'transfer') {
      continue
    }

    if (record.amountCents > 0) {
      income += record.amountCents
    } else {
      expense += -record.amountCents
    }
  }

  return { income, expense, net: income - expense, count: records.length }
}

export function formatCents(cents: number): string {
  const sign = cents >= 0 ? '+' : '-'
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)}`
}

export function formatPlainCents(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2)
}

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function pickPaletteColor(usedColors: Set<string>): string {
  const available = DEFAULT_CATEGORY_PALETTE.find((color) => !usedColors.has(color))
  return available ?? DEFAULT_CATEGORY_PALETTE[DEFAULT_CATEGORY_PALETTE.length - 1]
}

export function assertValidDate(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('日期格式无效，必须为 YYYY-MM-DD。')
  }
  const [year, month, day] = dateText.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('日期无效。')
  }
}

export function assertValidAmountCents(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    throw new Error('金额必须是非零的两位小数金额。')
  }
  if (Math.abs(amountCents) > 999999999) {
    throw new Error('金额超出允许范围。')
  }
}

export function assertValidNote(note: string) {
  if (note.length > 200) {
    throw new Error('备注不能超过 200 个字符。')
  }
}

export function buildMonthWindow(selectedMonth: string, count: number): string[] {
  const [year, month] = selectedMonth.split('-').map(Number)
  const list: string[] = []
  let y = year
  let m = month
  for (let i = 0; i < count; i++) {
    list.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return list
}

export function buildYearWindow(selectedYear: string, count: number): string[] {
  const year = Number(selectedYear)
  return Array.from({ length: count }, (_, i) => String(year - count + 1 + i))
}

export function expenseTotal(records: Bill[], categories: BillCategory[]): number {
  let total = 0
  for (const record of records) {
    if (resolveCategory(categories, record.amountCents, record.category).type === 'expense') {
      total += -record.amountCents
    }
  }
  return total
}

export function incomeTotal(records: Bill[], categories: BillCategory[]): number {
  let total = 0
  for (const record of records) {
    if (resolveCategory(categories, record.amountCents, record.category).type === 'income') {
      total += record.amountCents
    }
  }
  return total
}

export function filterBillsByType(
  records: Bill[],
  type: BillType,
  categories: BillCategory[],
): Bill[] {
  return records.filter(
    (record) => resolveCategory(categories, record.amountCents, record.category).type === type,
  )
}

export function toBillQueryRecord(bill: Bill): BillQueryRecord {
  return {
    id: bill.id,
    date: bill.date,
    amountCents: bill.amountCents,
    amount: bill.amountCents / 100,
    category: bill.category,
    note: bill.note,
  }
}

export function filterBillsByMonth(records: Bill[], month: string): Bill[] {
  return records.filter((record) => record.date.slice(5, 7) === month)
}

// records 需按 date 降序（最新在前），返回最新 monthCount 个月的记录，保持原顺序
export function sliceLatestMonths(records: Bill[], monthCount: number): Bill[] {
  if (monthCount <= 0) {
    return []
  }

  const seen = new Set<string>()
  let kept = 0
  let cutIndex = records.length
  for (let i = 0; i < records.length; i++) {
    const month = records[i].date.slice(0, 7)
    if (!seen.has(month)) {
      if (kept >= monthCount) {
        cutIndex = i
        break
      }
      seen.add(month)
      kept += 1
    }
  }
  return records.slice(0, cutIndex)
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function buildDailyAxis(year: number): string[] {
  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const dates: string[] = []
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= monthDays[m - 1]; d++) {
      dates.push(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  }
  return dates
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// 每日平均支出：expenseCents ÷ 该月已经历天数，四舍五入到分
// 当前月传 todayDay（今天几号）按已过天数计算；过去月份省略则按当月自然天数
export function averageDailyExpense(
  expenseCents: number,
  year: number,
  month: number,
  todayDay?: number,
): number {
  const fullDays = daysInMonth(year, month)
  const days = todayDay === undefined ? fullDays : Math.min(todayDay, fullDays)
  return Math.round(expenseCents / days)
}

// 每月平均支出：expenseCents ÷ 12，四舍五入到分
export function averageMonthlyExpense(expenseCents: number): number {
  return Math.round(expenseCents / 12)
}

// 返回 records 中指定月份（year-month）内有记录的最晚日期 YYYY-MM-DD；无记录返回 null
export function lastRecordedDateOfMonth(records: Bill[], year: string, month: string): string | null {
  const prefix = `${year}-${month}`
  let latest: string | null = null
  for (const record of records) {
    if (record.date.startsWith(prefix)) {
      if (latest === null || record.date > latest) {
        latest = record.date
      }
    }
  }
  return latest
}

// ===== 备注搜索 =====

export const BILLS_SEARCH_PAGE_SIZE = 30

// 备注是否包含关键词（keyword 视为已 trim；空关键词返回 false）。
// 不区分大小写（ASCII），镜像 SQLite LIKE 默认行为，保证就地计算与服务端结果一致。
export function billMatchesKeyword(note: string, keyword: string): boolean {
  if (!keyword) return false
  return note.toLowerCase().includes(keyword.toLowerCase())
}

// 命中词切分（高亮渲染用）：非正则、按 indexOf 顺序、大小写不敏感命中但保留原文，
// 多处命中全部切出；keyword 为空时整体一段（hit=false）。
export function splitNoteByKeyword(
  note: string,
  keyword: string,
): Array<{ text: string; hit: boolean }> {
  if (!keyword) {
    return [{ text: note, hit: false }]
  }

  const lowerNote = note.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const segments: Array<{ text: string; hit: boolean }> = []
  let index = 0

  while (true) {
    const found = lowerNote.indexOf(lowerKeyword, index)
    if (found === -1) break
    if (found > index) {
      segments.push({ text: note.slice(index, found), hit: false })
    }
    segments.push({ text: note.slice(found, found + keyword.length), hit: true })
    index = found + keyword.length
  }

  if (index < note.length) {
    segments.push({ text: note.slice(index), hit: false })
  }

  return segments.length > 0 ? segments : [{ text: note, hit: false }]
}

// 单条记录的收支贡献（分）。与 aggregateRecords 完全同口径：
// resolveCategory 后 transfer → { 0, 0 }；否则正数计入 income、负数计入 expense（正数分）。
export function billSearchContribution(
  categories: BillCategory[],
  bill: Bill,
): { income: number; expense: number } {
  const resolved = resolveCategory(categories, bill.amountCents, bill.category)
  if (resolved.type === 'transfer') {
    return { income: 0, expense: 0 }
  }
  return bill.amountCents > 0
    ? { income: bill.amountCents, expense: 0 }
    : { income: 0, expense: -bill.amountCents }
}

// 分类重命名对单条记录的改写，规则与主进程 updateCategory 的 SQL 一致：
//   transfer: category === oldName → 改写
//   expense : category === oldName && amountCents < 0 → 改写
//   income  : category === oldName && amountCents > 0 → 改写
// 不满足则原样返回（返回同一引用）。
export function applyCategoryRenameToBill(
  bill: Bill,
  rename: { type: BillType; oldName: string; newName: string },
): Bill {
  if (bill.category !== rename.oldName) return bill
  const shouldRename =
    rename.type === 'transfer' ||
    (rename.type === 'expense' && bill.amountCents < 0) ||
    (rename.type === 'income' && bill.amountCents > 0)
  return shouldRename ? { ...bill, category: rename.newName } : bill
}

// 就地应用一次变更到搜索窗口（渲染层"操作后不重查"的核心）。
// 统计恒定镜像匹配集：命中/失配决定 total 与收支增量，窗口只影响 records。
//   create / duplicate：命中 → total+1、按贡献累加（无论是否进窗）；能排进窗口则插入
//   update：仍匹配 → 仅"新贡献 − 旧贡献"（total 不变）；能排进窗口则替换，
//           排序位置到达/超出窗口末位则移出窗口；不再匹配 → 移除 + total−1 + 减旧贡献
//   delete：移除 + total−1 + 减旧贡献
// 空窗口直接插入（"无匹配 → 首条命中"场景；排序位置到达/超出窗口末位时一律不插入，
// 保证 offset = records.length 续取不漏不重）。
// needsRefill = 发生了净移除（移除且未补回）且 total > records.length，调用方应补位取 1 条。
export function applyBillsMutation(
  window: BillsSearchWindow,
  mutation: BillsSearchMutation,
  categories: BillCategory[],
  keyword: string,
): { window: BillsSearchWindow; needsRefill: boolean } {
  const records = [...window.records]
  let { total, income, expense } = window

  function removeById(id: number): boolean {
    const index = records.findIndex((record) => record.id === id)
    if (index === -1) return false
    records.splice(index, 1)
    return true
  }

  // 返回是否插入；"排序位置到达/超出窗口末位"（空窗口除外）视为未进窗
  function tryInsert(bill: Bill): boolean {
    if (records.length === 0) {
      records.push(bill)
      return true
    }
    const index = records.findIndex(
      (record) => bill.date > record.date || (bill.date === record.date && bill.id > record.id),
    )
    const insertAt = index === -1 ? records.length : index
    if (insertAt >= records.length) return false
    records.splice(insertAt, 0, bill)
    return true
  }

  if (mutation.kind === 'delete') {
    const contribution = billSearchContribution(categories, mutation.bill)
    const removed = removeById(mutation.bill.id)
    total -= 1
    income -= contribution.income
    expense -= contribution.expense
    return {
      window: { records, total, income, expense },
      needsRefill: removed && total > records.length,
    }
  }

  if (mutation.kind === 'update') {
    const previousContribution = billSearchContribution(categories, mutation.previous)
    const removed = removeById(mutation.previous.id)

    if (!billMatchesKeyword(mutation.bill.note, keyword)) {
      total -= 1
      income -= previousContribution.income
      expense -= previousContribution.expense
      return {
        window: { records, total, income, expense },
        needsRefill: removed && total > records.length,
      }
    }

    const nextContribution = billSearchContribution(categories, mutation.bill)
    income += nextContribution.income - previousContribution.income
    expense += nextContribution.expense - previousContribution.expense
    const inserted = tryInsert(mutation.bill)
    return {
      window: { records, total, income, expense },
      needsRefill: removed && !inserted && total > records.length,
    }
  }

  // create / duplicate
  if (!billMatchesKeyword(mutation.bill.note, keyword)) {
    return { window: { records, total, income, expense }, needsRefill: false }
  }

  const contribution = billSearchContribution(categories, mutation.bill)
  total += 1
  income += contribution.income
  expense += contribution.expense
  tryInsert(mutation.bill)
  return { window: { records, total, income, expense }, needsRefill: false }
}