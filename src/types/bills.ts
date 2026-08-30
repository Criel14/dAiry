export type BillType = 'expense' | 'income' | 'transfer'

export interface BillCategory {
  type: BillType
  name: string
  color: string
  icon: string
  builtin: boolean
}

export interface Bill {
  id: number
  date: string
  amountCents: number
  category: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface BillsListMonthInput {
  workspacePath: string
  month: string
}

export interface BillsListYearInput {
  workspacePath: string
  year: string
}

export interface BillsListMonthsInput {
  workspacePath: string
  year: string
}

export interface BillsRecordInput {
  workspacePath: string
  date: string
  amountCents: number
  category: string
  note: string
}

export interface BillsUpdateInput extends BillsRecordInput {
  id: number
}

export interface BillsDeleteInput {
  workspacePath: string
  id: number
}

export interface BillsCategoryQuery {
  workspacePath: string
}

export interface BillsCreateCategoryInput {
  workspacePath: string
  type: BillType
  name: string
}

export interface BillsRenameCategoryInput {
  workspacePath: string
  type: BillType
  name: string
  newName: string
}

export interface BillsDeleteCategoryInput {
  workspacePath: string
  type: BillType
  name: string
}

export interface BillsExportResult {
  path: string | null
  canceled: boolean
}

export interface BillsWindowTotal {
  period: string
  total: number
  income: number
}

export type BillsChartJumpPayload =
  | { kind: 'category'; category: string }
  | { kind: 'day'; date: string } // 'YYYY-MM-DD'，滚动定位到该日分组
  | { kind: 'month'; month: string } // 'YYYY-MM'，切换 selectedMonth
  | { kind: 'monthOfYear'; month: string; scrollDate: string | null } // 'MM' + 该月有记录的最晚一天
  | { kind: 'year'; year: string } // 'YYYY'，切换 selectedYear

export type BillsQueryRange =
  | { month: string }
  | { year: string }
  | { start: string; end: string }

export interface BillsQueryInput {
  workspacePath: string
  range: BillsQueryRange
  category?: string
  type?: BillType
  keyword?: string
  limit: number
}

export interface BillQueryRecord {
  id: number
  date: string
  amountCents: number
  amount: number
  category: string
  note: string
}

export interface BillsQuerySummary {
  income: number
  expense: number
  net: number
  count: number
}

export interface BillsQueryResult {
  range: { start: string; end: string }
  filter: { category: string | null; type: BillType | null; keyword: string | null }
  summary: BillsQuerySummary
  truncated: boolean
  limit: number
  records: BillQueryRecord[]
}

export const BILL_TYPES: BillType[] = ['expense', 'income', 'transfer']

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '不计入收支',
}

export const FALLBACK_CATEGORY_NAME = '其他'

export const DEFAULT_CATEGORY_PALETTE = [
  '#6E9C9C',
  '#7A9BAE',
  '#8A7FA8',
  '#B5A06E',
  '#A8896F',
  '#C47A6A',
  '#6B8FA3',
  '#5E8C61',
  '#B0795F',
  '#7F9B7F',
]

export const BUILTIN_CATEGORIES: BillCategory[] = [
  { type: 'expense', name: '餐饮', color: '#5E8C61', icon: 'utensils', builtin: true },
  { type: 'expense', name: '购物', color: '#7A9BAE', icon: 'shopping-bag', builtin: true },
  { type: 'expense', name: '娱乐', color: '#A8896F', icon: 'gamepad-2', builtin: true },
  { type: 'expense', name: '交通', color: '#6E9C9C', icon: 'bus', builtin: true },
  { type: 'expense', name: '生活缴费', color: '#6B8FA3', icon: 'receipt-text', builtin: true },
  { type: 'expense', name: '医疗', color: '#C47A6A', icon: 'stethoscope', builtin: true },
  { type: 'expense', name: '转账', color: '#8B948E', icon: 'arrow-right-left', builtin: true },
  { type: 'expense', name: '服务', color: '#B5A06E', icon: 'wrench', builtin: true },
  { type: 'expense', name: '教育', color: '#8A7FA8', icon: 'graduation-cap', builtin: true },
  { type: 'expense', name: '公益', color: '#7FA87F', icon: 'hand-heart', builtin: true },
  { type: 'expense', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
  { type: 'income', name: '工资', color: '#5A9F61', icon: 'wallet', builtin: true },
  { type: 'income', name: '奖金', color: '#B5A06E', icon: 'trophy', builtin: true },
  { type: 'income', name: '转账', color: '#8B948E', icon: 'arrow-right-left', builtin: true },
  { type: 'income', name: '生意', color: '#5E8C61', icon: 'store', builtin: true },
  { type: 'income', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
  { type: 'transfer', name: '理财', color: '#8A7FA8', icon: 'piggy-bank', builtin: true },
  { type: 'transfer', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
]
