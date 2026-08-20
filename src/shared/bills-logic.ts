import {
  DEFAULT_CATEGORY_PALETTE,
  FALLBACK_CATEGORY_NAME,
  type Bill,
  type BillCategory,
  type BillQueryRecord,
  type BillType,
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
