import { DEFAULT_CATEGORY_PALETTE, FALLBACK_CATEGORY_NAME, type Bill, type BillCategory, type BillType } from '../../../src/types/bills'

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
  const parsed = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
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
