# dAiry 记账功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dAiry 中新增「记账」视图：SQLite 存储账单（better-sqlite3）、JSON 分类库、明细/统计浏览、录入编辑删除、导出 Excel，UI 风格与项目主题体系一致。

**Architecture:** 独立业务域模块。主进程 `electron/main/bills/`（db / categories / logic / service / export）+ 渲染进程 `src/components/bills/`（Sidebar 月份选择器 / Panel 明细统计 / 记录弹窗 / ECharts 图表），`RightPanel` 扩展 `'bills'`，ActivityBar 新增「记账」导航。

**Tech Stack:** Electron 30 + Vue 3 + Vite 5 + TypeScript、better-sqlite3（原生模块）、exceljs（xlsx 导出）、echarts（图表）、vitest（主进程纯逻辑单测）。

---

**环境与约定：**
- Windows 下 npm 命令优先通过 `cmd` 执行（AGENTS.md 约定）；本计划中的 `npm ...` 可用 `cmd /c npm ...` 执行
- 提交粒度：每个任务一次 commit，message 用 `feat(bills): ...` 风格
- 测试目录 `tests/`（根目录，tsconfig include 不含 tests，vitest 独立编译，不参与 vue-tsc）

---

### Task 1: vitest 测试基础设施

**Files:**
- Modify: `package.json`（scripts 增加 test）
- Create: `vitest.config.ts`
- Create: `tests/bills/smoke.test.ts`

- [ ] **Step 1: 安装 vitest 并添加 test script**

```bash
npm install -D vitest
```

`package.json` 的 `scripts` 增加：

```json
"test": "vitest run"
```

- [ ] **Step 2: 创建 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: 创建冒烟测试 tests/bills/smoke.test.ts**

```ts
import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm run test`
Expected: PASS，1 个测试通过

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/bills/smoke.test.ts
git commit -m "test: add vitest infrastructure for bills module"
```

---

### Task 2: 共享类型、IPC 通道、API 与 preload

**Files:**
- Create: `src/types/bills.ts`
- Modify: `src/types/index.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/types/api.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 创建 src/types/bills.ts**

```ts
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
  { type: 'expense', name: '交通', color: '#6E9C9C', icon: 'bus', builtin: true },
  { type: 'expense', name: '购物', color: '#7A9BAE', icon: 'shopping-bag', builtin: true },
  { type: 'expense', name: '教育', color: '#8A7FA8', icon: 'graduation-cap', builtin: true },
  { type: 'expense', name: '服务', color: '#B5A06E', icon: 'wrench', builtin: true },
  { type: 'expense', name: '娱乐', color: '#A8896F', icon: 'gamepad-2', builtin: true },
  { type: 'expense', name: '生活缴费', color: '#6B8FA3', icon: 'receipt-text', builtin: true },
  { type: 'expense', name: '医疗', color: '#C47A6A', icon: 'stethoscope', builtin: true },
  { type: 'expense', name: '转账', color: '#8B948E', icon: 'arrow-right-left', builtin: true },
  { type: 'expense', name: '公益', color: '#7FA87F', icon: 'hand-heart', builtin: true },
  { type: 'expense', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
  { type: 'income', name: '工资', color: '#5A9F61', icon: 'wallet', builtin: true },
  { type: 'income', name: '生意', color: '#5E8C61', icon: 'store', builtin: true },
  { type: 'income', name: '奖金', color: '#B5A06E', icon: 'trophy', builtin: true },
  { type: 'income', name: '转账', color: '#8B948E', icon: 'arrow-right-left', builtin: true },
  { type: 'income', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
  { type: 'transfer', name: '理财', color: '#8A7FA8', icon: 'piggy-bank', builtin: true },
  { type: 'transfer', name: '其他', color: '#8B948E', icon: 'ellipsis', builtin: true },
]
```

- [ ] **Step 2: 修改 src/types/index.ts 增加导出**

在第 1 行 `export * from './ai'` 之前加入：

```ts
export * from './bills'
```

- [ ] **Step 3: 修改 src/shared/ipc-channels.ts**

在 `// timeline` 分组之后、对象结尾 `} as const` 之前追加：

```ts
  // bills
  listBillsByMonth: 'bills:list-month',
  listBillsByYear: 'bills:list-year',
  createBill: 'bills:create',
  updateBill: 'bills:update',
  deleteBill: 'bills:delete',
  getBillCategories: 'bills:get-categories',
  createBillCategory: 'bills:create-category',
  renameBillCategory: 'bills:update-category',
  deleteBillCategory: 'bills:delete-category',
  exportBillsExcel: 'bills:export-excel',
```

- [ ] **Step 4: 修改 src/types/api.ts**

import 区（`import type { RightPanel } from './ui'` 之前）加入：

```ts
import type {
  Bill,
  BillCategory,
  BillsCategoryQuery,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsExportResult,
  BillsListMonthInput,
  BillsListYearInput,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsUpdateInput,
} from './bills'
```

`DairyApi` 接口末尾（`onTimelineRebuildProgress` 之后、`}` 之前）追加：

```ts
  listBillsByMonth: (input: BillsListMonthInput) => Promise<Bill[]>
  listBillsByYear: (input: BillsListYearInput) => Promise<Bill[]>
  createBill: (input: BillsRecordInput) => Promise<Bill>
  updateBill: (input: BillsUpdateInput) => Promise<Bill>
  deleteBill: (input: BillsDeleteInput) => Promise<void>
  getBillCategories: (input: BillsCategoryQuery) => Promise<BillCategory[]>
  createBillCategory: (input: BillsCreateCategoryInput) => Promise<BillCategory[]>
  renameBillCategory: (input: BillsRenameCategoryInput) => Promise<BillCategory[]>
  deleteBillCategory: (input: BillsDeleteCategoryInput) => Promise<BillCategory[]>
  exportBillsExcel: (input: BillsCategoryQuery) => Promise<BillsExportResult>
```

- [ ] **Step 5: 修改 electron/preload.ts**

在 `onTimelineRebuildProgress` 实现之后、`contextBridge.exposeInMainWorld` 之前追加：

```ts
  listBillsByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsByMonth, input),
  listBillsByYear: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsByYear, input),
  createBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.createBill, input),
  updateBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.updateBill, input),
  deleteBill: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteBill, input),
  getBillCategories: (input) => ipcRenderer.invoke(IPC_CHANNELS.getBillCategories, input),
  createBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.createBillCategory, input),
  renameBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.renameBillCategory, input),
  deleteBillCategory: (input) => ipcRenderer.invoke(IPC_CHANNELS.deleteBillCategory, input),
  exportBillsExcel: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportBillsExcel, input),
```

- [ ] **Step 6: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/types/bills.ts src/types/index.ts src/shared/ipc-channels.ts src/types/api.ts electron/preload.ts
git commit -m "feat(bills): add shared types, ipc channels, api and preload bridge"
```

---

### Task 3: 主进程纯逻辑层 logic.ts（TDD）

**Files:**
- Create: `tests/bills/logic.test.ts`
- Create: `electron/main/bills/logic.ts`

- [ ] **Step 1: 编写失败测试 tests/bills/logic.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import {
  aggregateRecords,
  formatCents,
  pickPaletteColor,
  resolveCategory,
  toCents,
} from '../../electron/main/bills/logic'
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
    const used = new Set(DEFAULT_PALETTE_ALL())
    expect(pickPaletteColor(used)).toBe('#7F9B7F')
  })
})

function DEFAULT_PALETTE_ALL() {
  return [
    '#6E9C9C', '#7A9BAE', '#8A7FA8', '#B5A06E', '#A8896F',
    '#C47A6A', '#6B8FA3', '#5E8C61', '#B0795F', '#7F9B7F',
  ]
}
```

注意：`DEFAULT_PALETTE_ALL` 仅用于耗尽色板场景，色板常量实际来自 `src/types/bills.ts` 的 `DEFAULT_CATEGORY_PALETTE`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/bills/logic.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 创建 electron/main/bills/logic.ts**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/bills/logic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/bills/logic.test.ts electron/main/bills/logic.ts
git commit -m "feat(bills): add pure logic layer with unit tests"
```

---

### Task 4: 安装依赖与打包配置

**Files:**
- Modify: `package.json`（依赖 + postinstall）
- Modify: `electron-builder.json5`（asarUnpack）

- [ ] **Step 1: 安装依赖**

```bash
npm install better-sqlite3 exceljs echarts
npm install -D @electron/rebuild
```

- [ ] **Step 2: 修改 package.json**

`scripts` 增加：

```json
"postinstall": "electron-builder install-app-deps",
```

- [ ] **Step 3: 修改 electron-builder.json5**

在 `"asar": true,` 之后增加：

```json5
"asarUnpack": ["**/node_modules/better-sqlite3/**"],
```

- [ ] **Step 4: 重建原生模块到 Electron ABI**

Run: `npm run postinstall`（即 `npx electron-builder install-app-deps`）
Expected: better-sqlite3 编译成功（首次需要 VS Build Tools，约几分钟）

如果此步失败（缺少 VS Build Tools / Python 等编译环境），停止并告知用户安装 VS Build Tools（工作负载：使用 C++ 的桌面开发），这是本功能唯一的平台前置依赖。

- [ ] **Step 5: 验证类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json electron-builder.json5
git commit -m "build(bills): add better-sqlite3, exceljs, echarts deps and native module unpack"
```

---

### Task 5: 数据库与分类库（db.ts / categories.ts）

**Files:**
- Create: `electron/main/bills/db.ts`
- Create: `electron/main/bills/categories.ts`

- [ ] **Step 1: 创建 electron/main/bills/db.ts**

```ts
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Bill } from '../../../src/types/bills'

export interface BillRow {
  id: number
  date: string
  amount_cents: number
  category: string
  note: string
  created_at: string
  updated_at: string
}

export function mapRowToBill(row: BillRow): Bill {
  return {
    id: row.id,
    date: row.date,
    amountCents: row.amount_cents,
    category: row.category,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SCHEMA_VERSION = 1

export function openBillsDatabase(workspacePath: string): Database.Database {
  const billsDir = path.join(workspacePath, 'bills')
  fs.mkdirSync(billsDir, { recursive: true })

  const db = new Database(path.join(billsDir, 'bills.db'))
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(db: Database.Database) {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bills (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        date          TEXT    NOT NULL,
        amount_cents  INTEGER NOT NULL,
        category      TEXT    NOT NULL,
        note          TEXT    NOT NULL DEFAULT '',
        created_at    TEXT    NOT NULL,
        updated_at    TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    `)
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
}

const connectionCache = new Map<string, Database.Database>()

export function getBillsDatabase(workspacePath: string): Database.Database {
  const cached = connectionCache.get(workspacePath)
  if (cached) {
    return cached
  }

  const db = openBillsDatabase(workspacePath)
  connectionCache.set(workspacePath, db)
  return db
}

export function closeBillsDatabase(workspacePath: string) {
  const db = connectionCache.get(workspacePath)
  if (db) {
    db.close()
    connectionCache.delete(workspacePath)
  }
}
```

- [ ] **Step 2: 创建 electron/main/bills/categories.ts**

```ts
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  BUILTIN_CATEGORIES,
  FALLBACK_CATEGORY_NAME,
  type BillCategory,
  type BillType,
} from '../../../src/types/bills'
import { pickPaletteColor } from './logic'

const CATEGORIES_FILE_NAME = 'bill-categories.json'
const CATEGORIES_VERSION = 1

interface CategoryFile {
  version: number
  categories: BillCategory[]
}

export function getBillCategoriesPath(workspacePath: string) {
  return path.join(workspacePath, '.dairy', CATEGORIES_FILE_NAME)
}

export async function getBillCategories(workspacePath: string): Promise<BillCategory[]> {
  try {
    const raw = await readFile(getBillCategoriesPath(workspacePath), 'utf-8')
    const parsed = JSON.parse(raw) as CategoryFile
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      return parsed.categories
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[bills] 分类文件读取失败，将重新播种：', error)
    }
  }

  return seedBillCategories(workspacePath)
}

async function seedBillCategories(workspacePath: string): Promise<BillCategory[]> {
  await saveBillCategories(workspacePath, BUILTIN_CATEGORIES)
  return [...BUILTIN_CATEGORIES]
}

export async function saveBillCategories(workspacePath: string, categories: BillCategory[]) {
  const file: CategoryFile = { version: CATEGORIES_VERSION, categories }
  await writeFile(getBillCategoriesPath(workspacePath), JSON.stringify(file, null, 2), 'utf-8')
}

function assertCanRename(categories: BillCategory[], type: BillType, name: string) {
  const target = categories.find((c) => c.type === type && c.name === name)
  if (!target) {
    throw new Error(`分类「${name}」不存在。`)
  }
  if (target.builtin) {
    throw new Error('内置分类不可改名。')
  }
}

function assertCanDelete(categories: BillCategory[], type: BillType, name: string) {
  const target = categories.find((c) => c.type === type && c.name === name)
  if (!target) {
    throw new Error(`分类「${name}」不存在。`)
  }
  if (target.builtin || name === FALLBACK_CATEGORY_NAME) {
    throw new Error('内置分类不可删除。')
  }
}

export async function createBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
): Promise<BillCategory[]> {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('分类名不能为空。')
  }
  if (normalizedName.length > 12) {
    throw new Error('分类名不能超过 12 个字符。')
  }

  const categories = await getBillCategories(workspacePath)
  if (categories.some((c) => c.type === type && c.name === normalizedName)) {
    throw new Error(`分类「${normalizedName}」已存在。`)
  }

  const usedColors = new Set(categories.map((c) => c.color))
  const next: BillCategory[] = [
    ...categories,
    { type, name: normalizedName, color: pickPaletteColor(usedColors), icon: 'tag', builtin: false },
  ]
  await saveBillCategories(workspacePath, next)
  return next
}

export async function renameBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
  newName: string,
): Promise<BillCategory[]> {
  const normalizedName = newName.trim()
  if (!normalizedName) {
    throw new Error('分类名不能为空。')
  }
  if (normalizedName.length > 12) {
    throw new Error('分类名不能超过 12 个字符。')
  }

  const categories = await getBillCategories(workspacePath)
  assertCanRename(categories, type, name)
  if (categories.some((c) => c.type === type && c.name === normalizedName)) {
    throw new Error(`分类「${normalizedName}」已存在。`)
  }

  const next = categories.map((c) =>
    c.type === type && c.name === name ? { ...c, name: normalizedName } : c,
  )
  await saveBillCategories(workspacePath, next)
  return next
}

export async function deleteBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
): Promise<BillCategory[]> {
  const categories = await getBillCategories(workspacePath)
  assertCanDelete(categories, type, name)

  const next = categories.filter((c) => !(c.type === type && c.name === name))
  await saveBillCategories(workspacePath, next)
  return next
}
```

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（better-sqlite3 自带类型声明，bundler mode 支持 CJS default import）

- [ ] **Step 4: Commit**

```bash
git add electron/main/bills/db.ts electron/main/bills/categories.ts
git commit -m "feat(bills): add sqlite database layer and category library"
```

---

### Task 6: 服务层与 IPC 注册

**Files:**
- Create: `electron/main/bills/service.ts`
- Create: `electron/main/ipc/bills.ts`
- Modify: `electron/main/ipc/index.ts`

- [ ] **Step 1: 创建 electron/main/bills/service.ts**

```ts
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
```

- [ ] **Step 2: 创建 electron/main/ipc/bills.ts**

```ts
import { ipcMain } from 'electron'
import type {
  BillsCategoryQuery,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsListMonthInput,
  BillsListYearInput,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsUpdateInput,
} from '../../../src/types/bills'
import { IPC_CHANNELS } from '../constants'
import {
  createBill,
  createCategory,
  deleteBill,
  listBillCategories,
  listBillsByMonth,
  listBillsByYear,
  removeCategory,
  updateBill,
  updateCategory,
} from '../bills/service'
import { exportBillsExcel } from '../bills/export'

export function registerBillsIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.listBillsByMonth, (_event, input: BillsListMonthInput) =>
    listBillsByMonth(input),
  )
  ipcMain.handle(IPC_CHANNELS.listBillsByYear, (_event, input: BillsListYearInput) =>
    listBillsByYear(input),
  )
  ipcMain.handle(IPC_CHANNELS.createBill, (_event, input: BillsRecordInput) => createBill(input))
  ipcMain.handle(IPC_CHANNELS.updateBill, (_event, input: BillsUpdateInput) => updateBill(input))
  ipcMain.handle(IPC_CHANNELS.deleteBill, (_event, input: BillsDeleteInput) => deleteBill(input))
  ipcMain.handle(IPC_CHANNELS.getBillCategories, (_event, input: BillsCategoryQuery) =>
    listBillCategories(input.workspacePath),
  )
  ipcMain.handle(IPC_CHANNELS.createBillCategory, (_event, input: BillsCreateCategoryInput) =>
    createCategory(input),
  )
  ipcMain.handle(IPC_CHANNELS.renameBillCategory, (_event, input: BillsRenameCategoryInput) =>
    updateCategory(input),
  )
  ipcMain.handle(IPC_CHANNELS.deleteBillCategory, (_event, input: BillsDeleteCategoryInput) =>
    removeCategory(input),
  )
  ipcMain.handle(IPC_CHANNELS.exportBillsExcel, (_event, input: BillsCategoryQuery) =>
    exportBillsExcel(input.workspacePath),
  )
}
```

- [ ] **Step 3: 修改 electron/main/ipc/index.ts**

在 import 区加入：

```ts
import { registerBillsIpcHandlers } from './bills'
```

在 `registerIpcHandlers()` 函数体末尾加入：

```ts
  registerBillsIpcHandlers()
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（export.ts 尚不存在，Task 7 创建，此时 typecheck 会报 export 模块缺失——如报错属预期，先忽略或按 Step 5 顺序调整：先做 Task 7 再回来 typecheck）

- [ ] **Step 5: Commit**

```bash
git add electron/main/bills/service.ts electron/main/ipc/bills.ts electron/main/ipc/index.ts
git commit -m "feat(bills): add service layer and ipc handlers"
```

---

### Task 7: Excel 导出（export.ts，TDD）

**Files:**
- Create: `tests/bills/export.test.ts`
- Create: `electron/main/bills/export.ts`

- [ ] **Step 1: 编写失败测试 tests/bills/export.test.ts**

```ts
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildBillsWorkbook } from '../../electron/main/bills/export'
import type { Bill } from '../../src/types/bills'

function makeBill(date: string, amountCents: number, category: string, note = ''): Bill {
  return {
    id: 1,
    date,
    amountCents,
    category,
    note,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

describe('buildBillsWorkbook', () => {
  it('creates one sheet per year with header row', async () => {
    const bills = [
      makeBill('2026-08-01', -2346, '餐饮', '黄焖鸡'),
      makeBill('2026-08-01', 12000, '工资'),
      makeBill('2025-12-31', -500, '交通'),
    ]
    const workbook = buildBillsWorkbook(bills)

    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['2025', '2026'])

    const sheet2026 = workbook.getWorksheet('2026')
    expect(sheet2026).toBeDefined()
    const header = sheet2026?.getRow(1)
    expect(header?.getCell(1).value).toBe('日期')
    expect(header?.getCell(2).value).toBe('金额')
    expect(header?.getCell(3).value).toBe('分类')
    expect(header?.getCell(4).value).toBe('备注')

    const row2 = sheet2026?.getRow(2)
    expect(row2?.getCell(1).value).toBe('2026-08-01')
    expect(row2?.getCell(2).value).toBe(-23.46)
    expect(row2?.getCell(3).value).toBe('餐饮')
    expect(row2?.getCell(4).value).toBe('黄焖鸡')
  })

  it('handles empty bills without creating sheets', async () => {
    const workbook = buildBillsWorkbook([])
    expect(workbook.worksheets.length).toBe(0)
  })

  it('sorts rows by date ascending', async () => {
    const bills = [
      makeBill('2026-08-02', -100, '餐饮'),
      makeBill('2026-08-01', -200, '餐饮'),
    ]
    const workbook = buildBillsWorkbook(bills)
    const sheet = workbook.getWorksheet('2026')
    expect(sheet?.getRow(2).getCell(1).value).toBe('2026-08-01')
    expect(sheet?.getRow(3).getCell(1).value).toBe('2026-08-02')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/bills/export.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 创建 electron/main/bills/export.ts**

```ts
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dialog } from 'electron'
import ExcelJS from 'exceljs'
import type { Bill, BillsExportResult } from '../../../src/types/bills'
import { getAllBills } from './service'

export function buildBillsWorkbook(bills: Bill[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const byYear = new Map<number, Bill[]>()

  for (const bill of bills) {
    const year = Number.parseInt(bill.date.slice(0, 4), 10)
    if (Number.isNaN(year)) {
      continue
    }
    const list = byYear.get(year) ?? []
    list.push(bill)
    byYear.set(year, list)
  }

  const years = [...byYear.keys()].sort((a, b) => a - b)
  for (const year of years) {
    const sheet = workbook.addWorksheet(String(year))
    const header = sheet.addRow(['日期', '金额', '分类', '备注'])
    header.font = { bold: true }

    const records = byYear.get(year) ?? []
    records.sort((a, b) => a.date.localeCompare(b.date))
    for (const bill of records) {
      sheet.addRow([bill.date, bill.amountCents / 100, bill.category, bill.note])
    }

    sheet.columns = [
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 40 },
    ]
  }

  return workbook
}

export async function exportBillsExcel(workspacePath: string): Promise<BillsExportResult> {
  const bills = await getAllBills(workspacePath)
  const workbook = buildBillsWorkbook(bills)

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出记账 Excel',
    defaultPath: path.join(workspacePath, 'bills.xlsx'),
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }],
  })

  if (canceled || !filePath) {
    return { path: null, canceled: true }
  }

  await workbook.xlsx.writeFile(filePath)
  return { path: filePath, canceled: false }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/bills/export.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add tests/bills/export.test.ts electron/main/bills/export.ts
git commit -m "feat(bills): add excel export via exceljs with tests"
```

---

### Task 8: 页面接线（RightPanel / ActivityBar / AppShell）

**Files:**
- Modify: `src/types/ui.ts`
- Modify: `src/app/components/ActivityBar/ActivityBar.vue`
- Modify: `src/app/composables/useAppShell.ts`
- Modify: `src/app/pages/AppShellPage.vue`

- [ ] **Step 1: 修改 src/types/ui.ts**

```ts
export type RightPanel = 'journal' | 'reports' | 'settings' | 'timeline' | 'workspace' | 'bills'
```

- [ ] **Step 2: 修改 ActivityBar.vue**

import 区加入 `Wallet`：

```ts
import {
  ChartColumnBig,
  FolderOpen,
  ListFilter,
  PencilLine,
  Settings,
  Wallet,
} from 'lucide-vue-next'
```

navItems 数组（`{ panel: 'timeline', ... }` 之后）加入：

```ts
  { panel: 'bills', label: '记账', icon: Wallet },
```

- [ ] **Step 3: 修改 src/app/composables/useAppShell.ts**

import 区加入：

```ts
import { useBillsPanel } from '../../components/bills/composables/useBillsPanel'
```

`useAppShell()` 函数体内（`const ai = useAppShellAi(state)` 之后）加入：

```ts
  const billsPanel = useBillsPanel(state.workspacePath)
```

`openWorkspacePage` 函数之后加入：

```ts
  function openBillsPage() {
    state.rightPanel.value = 'bills'
  }
```

return 对象中 `openReportsPage,` 之后加入：

```ts
    openBillsPage,
    billsPanel,
```

- [ ] **Step 4: 修改 AppShellPage.vue**

import 区加入：

```ts
import BillsSidebar from '../../components/bills/components/BillsSidebar/BillsSidebar.vue'
import BillsPanel from '../../components/bills/components/BillsPanel/BillsPanel.vue'
```

解构处加入（`openWorkspacePage,` 之后）：

```ts
  openBillsPage,
  billsPanel,
```

`handleActivitySelect` 中 `else if (panel === 'workspace')` 分支之后加入：

```ts
  } else if (panel === 'bills') {
    openBillsPage()
  }
```

WorkspaceSidebar 的 `<template #context>` 内（`TimelineSidebar` 分支之后、`</template>` 之前）加入：

```html
        <BillsSidebar
          v-else-if="rightPanel === 'bills'"
          :has-workspace="billsPanel.hasWorkspace.value"
          :workspace-path="workspacePath"
          :selected-month="billsPanel.selectedMonth.value"
          :categories="billsPanel.categories.value"
          :is-loading-categories="billsPanel.isLoadingCategories.value"
          :is-exporting="billsPanel.isExporting.value"
          :status-message="billsPanel.sidebarStatusMessage.value"
          @update:selected-month="billsPanel.selectedMonth.value = $event"
          @category-changed="billsPanel.handleCategoriesChanged"
          @export="billsPanel.handleExportExcel"
        />
```

`<main class="editor-shell">` 内（`TimelinePage` 的 section 之后、`workspace-welcome` 之前）加入：

```html
      <BillsPanel
        v-else-if="rightPanel === 'bills'"
        :has-workspace="billsPanel.hasWorkspace.value"
        :workspace-path="workspacePath"
        :selected-month="billsPanel.selectedMonth.value"
        :month-records="billsPanel.monthRecords.value"
        :year-records="billsPanel.yearRecords.value"
        :categories="billsPanel.categories.value"
        :active-tab="billsPanel.activeTab.value"
        :stats-scope="billsPanel.statsScope.value"
        :is-loading="billsPanel.isLoading.value"
        :status-message="billsPanel.statusMessage.value"
        :modal-state="billsPanel.modalState.value"
        @update:active-tab="billsPanel.activeTab.value = $event"
        @update:stats-scope="billsPanel.statsScope.value = $event"
        @open-create="billsPanel.openCreateModal"
        @open-edit="billsPanel.openEditModal"
        @close-modal="billsPanel.closeModal"
        @record-saved="billsPanel.handleRecordSaved"
        @delete-record="billsPanel.handleDeleteRecord"
      />
```

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 报错指向尚不存在的 bills 组件（Task 9-11 创建），属预期。若想提前验证接线语法，可等 Task 11 完成后统一检查。

- [ ] **Step 6: Commit**

```bash
git add src/types/ui.ts src/app/components/ActivityBar/ActivityBar.vue src/app/composables/useAppShell.ts src/app/pages/AppShellPage.vue
git commit -m "feat(bills): wire bills view into app shell navigation"
```

---

### Task 9: BillsSidebar（月份选择器 + 分类管理 + 导出按钮）

**Files:**
- Create: `src/components/bills/bills-icons.ts`
- Create: `src/components/bills/composables/useBillsSidebar.ts`
- Create: `src/components/bills/components/BillsSidebar/BillsSidebar.vue`
- Create: `src/components/bills/components/BillsSidebar/BillsSidebar.css`

- [ ] **Step 1: 创建 src/components/bills/bills-icons.ts**

```ts
import {
  ArrowRightLeft,
  Bus,
  Ellipsis,
  Gamepad2,
  GraduationCap,
  HandHeart,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  Stethoscope,
  Store,
  Tag,
  Trophy,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-vue-next'

const ICON_MAP: Record<string, LucideIcon> = {
  'arrow-right-left': ArrowRightLeft,
  bus: Bus,
  ellipsis: Ellipsis,
  'gamepad-2': Gamepad2,
  'graduation-cap': GraduationCap,
  'hand-heart': HandHeart,
  'piggy-bank': PiggyBank,
  'receipt-text': ReceiptText,
  'shopping-bag': ShoppingBag,
  stethoscope: Stethoscope,
  store: Store,
  tag: Tag,
  trophy: Trophy,
  utensils: Utensils,
  wallet: Wallet,
  wrench: Wrench,
}

export function iconForName(name: string): LucideIcon {
  return ICON_MAP[name] ?? Ellipsis
}
```

- [ ] **Step 2: 创建 src/components/bills/composables/useBillsSidebar.ts**

```ts
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { BillType } from '../../../types/bills'
import { BILL_TYPE_LABELS, BILL_TYPES } from '../../../types/bills'
import { getReadableErrorMessage } from '../../../utils/error'

export interface BillsSidebarProps {
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  categories: BillCategory[]
  isLoadingCategories: boolean
  isExporting: boolean
  statusMessage: string
}

export type BillsSidebarEmits = {
  'update:selectedMonth': [value: string]
  categoryChanged: []
  export: []
}

type BillsSidebarEmitFn = <K extends keyof BillsSidebarEmits>(
  event: K,
  ...args: BillsSidebarEmits[K]
) => void

const monthLabels = [
  '1 月', '2 月', '3 月', '4 月', '5 月', '6 月',
  '7 月', '8 月', '9 月', '10 月', '11 月', '12 月',
]

export function useBillsSidebar(props: BillsSidebarProps, emit: BillsSidebarEmitFn) {
  const monthPickerYear = ref(parseMonthYear(props.selectedMonth))
  const isCategoryPanelExpanded = ref(false)
  const categoryPanelTab = ref<BillType>('expense')
  const newCategoryName = ref('')
  const categoryError = ref('')

  watch(
    () => props.selectedMonth,
    (value) => {
      monthPickerYear.value = parseMonthYear(value)
    },
    { immediate: true },
  )

  const monthPickerTitle = computed(() => `${monthPickerYear.value} 年`)
  const monthCells = computed(() =>
    monthLabels.map((label, index) => {
      const key = dayjs().year(monthPickerYear.value).month(index).format('YYYY-MM')
      return {
        key,
        label,
        isSelected: key === props.selectedMonth,
        isCurrent: key === dayjs().format('YYYY-MM'),
      }
    }),
  )

  const categoriesOfTab = computed(() =>
    props.categories.filter((c) => c.type === categoryPanelTab.value),
  )
  const typeTabs = computed(() =>
    BILL_TYPES.map((type) => ({ type, label: BILL_TYPE_LABELS[type] })),
  )

  function shiftMonthPickerYear(amount: number) {
    monthPickerYear.value += amount
  }

  function selectMonth(key: string) {
    emit('update:selectedMonth', key)
  }

  function goToCurrentMonth() {
    monthPickerYear.value = dayjs().year()
    emit('update:selectedMonth', dayjs().format('YYYY-MM'))
  }

  function switchCategoryTab(type: BillType) {
    categoryPanelTab.value = type
    categoryError.value = ''
  }

  async function handleCreateCategory() {
    if (!props.workspacePath) return
    const name = newCategoryName.value.trim()
    if (!name) {
      categoryError.value = '请输入分类名'
      return
    }
    try {
      await window.dairy.createBillCategory({
        workspacePath: props.workspacePath,
        type: categoryPanelTab.value,
        name,
      })
      newCategoryName.value = ''
      categoryError.value = ''
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '创建分类失败')
    }
  }

  async function handleRenameCategory(type: BillType, name: string, newName: string) {
    if (!props.workspacePath) return
    try {
      await window.dairy.renameBillCategory({
        workspacePath: props.workspacePath,
        type,
        name,
        newName,
      })
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '重命名分类失败')
    }
  }

  function handleRenamePrompt(name: string) {
    const newName = window.prompt('输入新的分类名', name)
    if (!newName || newName.trim() === '' || newName.trim() === name) {
      return
    }
    void handleRenameCategory(categoryPanelTab.value, name, newName.trim())
  }

  async function handleDeleteCategory(type: BillType, name: string) {
    if (!props.workspacePath) return
    const confirmed = window.confirm(`删除分类「${name}」？历史账单将回退为其他样式。`)
    if (!confirmed) return
    try {
      await window.dairy.deleteBillCategory({
        workspacePath: props.workspacePath,
        type,
        name,
      })
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '删除分类失败')
    }
  }

  return {
    categoriesOfTab,
    categoryError,
    categoryPanelTab,
    goToCurrentMonth,
    handleCreateCategory,
    handleDeleteCategory,
    handleRenamePrompt,
    isCategoryPanelExpanded,
    monthCells,
    monthPickerTitle,
    newCategoryName,
    selectMonth,
    shiftMonthPickerYear,
    switchCategoryTab,
    typeTabs,
  }
}

function parseMonthYear(value: string) {
  const parsedDate = dayjs(`${value}-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}
```

注意：`BillCategory` 类型需在 import 中一并引入（`import type { BillCategory, BillType } from '../../../types/bills'`）。

- [ ] **Step 3: 创建 BillsSidebar.vue**

```vue
<script setup lang="ts">
import { ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight, Download, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { useBillsSidebar, type BillsSidebarEmits, type BillsSidebarProps } from '../../composables/useBillsSidebar'
import { iconForName } from '../../bills-icons'

const props = defineProps<BillsSidebarProps>()
const emit = defineEmits<BillsSidebarEmits>()

const {
  categoriesOfTab,
  categoryError,
  categoryPanelTab,
  goToCurrentMonth,
  handleCreateCategory,
  handleDeleteCategory,
  handleRenamePrompt,
  isCategoryPanelExpanded,
  monthCells,
  monthPickerTitle,
  newCategoryName,
  selectMonth,
  shiftMonthPickerYear,
  switchCategoryTab,
  typeTabs,
} = useBillsSidebar(props, emit)
</script>

<template>
  <div v-if="!hasWorkspace" class="bills-sidebar-empty">
    <h3>记账</h3>
    <p>先选择一个工作区，这里会显示月份选择、分类管理和导出入口。</p>
  </div>

  <div v-else class="bills-sidebar-stack">
    <section class="panel-card">
      <h3 class="panel-title">记账月份</h3>

      <section class="selector-card">
        <header class="selector-toolbar">
          <button class="toolbar-button" type="button" title="上一年" aria-label="上一年" @click="shiftMonthPickerYear(-1)">
            <ChevronsLeft class="toolbar-icon" aria-hidden="true" />
          </button>
          <strong class="selector-title">{{ monthPickerTitle }}</strong>
          <button class="toolbar-button" type="button" title="下一年" aria-label="下一年" @click="shiftMonthPickerYear(1)">
            <ChevronsRight class="toolbar-icon" aria-hidden="true" />
          </button>
        </header>

        <div class="picker-grid picker-grid--month">
          <button
            v-for="item in monthCells"
            :key="item.key"
            class="picker-cell"
            :class="{
              'picker-cell--selected': item.isSelected,
              'picker-cell--current': item.isCurrent,
            }"
            type="button"
            @click="selectMonth(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <button class="today-button" type="button" @click="goToCurrentMonth">回到本月</button>
      </section>
    </section>

    <section class="panel-card">
      <button
        class="section-toggle"
        type="button"
        :aria-expanded="isCategoryPanelExpanded"
        @click="isCategoryPanelExpanded = !isCategoryPanelExpanded"
      >
        <span class="section-toggle-copy">
          <span class="section-toggle-label">分类管理</span>
          <span class="section-toggle-summary">内置分类不可删除，新增分类自动分配样式</span>
        </span>
        <component :is="isCategoryPanelExpanded ? ChevronUp : ChevronDown" class="section-toggle-icon" aria-hidden="true" />
      </button>

      <div v-if="isCategoryPanelExpanded" class="category-panel">
        <div class="category-type-tabs">
          <button
            v-for="tab in typeTabs"
            :key="tab.type"
            class="category-type-tab"
            :class="{ 'category-type-tab--active': categoryPanelTab === tab.type }"
            type="button"
            @click="switchCategoryTab(tab.type)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="category-list">
          <div v-for="category in categoriesOfTab" :key="`${category.type}:${category.name}`" class="category-row">
            <span class="category-swatch" :style="{ backgroundColor: category.color }">
              <component :is="iconForName(category.icon)" class="category-swatch-icon" aria-hidden="true" />
            </span>
            <span class="category-name">{{ category.name }}</span>
            <template v-if="category.builtin">
              <span class="category-builtin-badge">内置</span>
            </template>
            <template v-else>
              <button
                class="category-action"
                type="button"
                title="重命名"
                aria-label="重命名"
                @click="handleRenamePrompt(category.name)"
              >
                <Pencil class="category-action-icon" aria-hidden="true" />
              </button>
              <button
                class="category-action category-action--danger"
                type="button"
                title="删除"
                aria-label="删除"
                @click="handleDeleteCategory(category.type, category.name)"
              >
                <Trash2 class="category-action-icon" aria-hidden="true" />
              </button>
            </template>
          </div>
        </div>

        <div class="category-create-row">
          <input
            v-model="newCategoryName"
            class="field-input category-create-input"
            type="text"
            maxlength="12"
            placeholder="新分类名"
            @keydown.enter="handleCreateCategory"
          />
          <button class="primary-button category-create-button" type="button" @click="handleCreateCategory">
            <Plus class="button-icon" aria-hidden="true" />
            新增
          </button>
        </div>
        <p v-if="categoryError" class="category-error">{{ categoryError }}</p>
      </div>
    </section>

    <section class="panel-card">
      <button
        class="primary-button export-button"
        type="button"
        :disabled="isExporting"
        @click="emit('export')"
      >
        <Download class="button-icon" aria-hidden="true" />
        <span>{{ isExporting ? '正在导出...' : '导出 Excel' }}</span>
      </button>
      <p v-if="statusMessage" class="report-status-inline">{{ statusMessage }}</p>
    </section>
  </div>
</template>

<style scoped src="./BillsSidebar.css"></style>
```

- [ ] **Step 4: 创建 BillsSidebar.css**

```css
.bills-sidebar-stack {
  display: grid;
  gap: 1.5rem;
  align-content: start;
}

.bills-sidebar-empty {
  display: grid;
  gap: 0.6rem;
  padding: 0.4rem 0 0;
}

.bills-sidebar-empty h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-subtle);
}

.bills-sidebar-empty p,
.report-status-inline {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.panel-card {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  padding: 0;
}

.panel-card + .panel-card {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.panel-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-subtle);
}

.selector-card {
  display: grid;
  gap: 0.9rem;
  margin-top: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: var(--color-glass-ivory-72);
}

.selector-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.selector-title {
  text-align: center;
  font-size: 0.98rem;
  color: var(--color-text-main);
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    color 160ms ease,
    opacity 160ms ease;
}

.toolbar-button:hover {
  color: var(--color-text-main);
  opacity: 0.9;
  transform: translateY(-1px);
}

.toolbar-icon {
  width: 1rem;
  height: 1rem;
}

.picker-grid {
  display: grid;
  gap: 0.55rem;
}

.picker-grid--month {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.picker-cell {
  min-height: 3rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-main);
  text-align: center;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.picker-cell:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.picker-cell--current {
  border-color: var(--color-border-calendar-today);
}

.picker-cell--selected {
  border-width: 2px;
  border-color: var(--color-border-selected-strong);
  font-weight: 600;
}

.today-button {
  min-height: 2.25rem;
  justify-self: start;
  padding: 0 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  font-size: 0.88rem;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.today-button:hover {
  color: var(--color-text-main);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-soft-sm);
  transform: translateY(-1px);
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
  padding: 0.15rem 0 0.35rem;
  border: 0;
  border-bottom: 1px solid var(--color-border-soft);
  background: transparent;
  color: var(--color-text-main);
  text-align: left;
}

.section-toggle-copy {
  display: grid;
  gap: 0.18rem;
}

.section-toggle-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.section-toggle-summary {
  font-size: 0.84rem;
  font-weight: 400;
  color: var(--color-text-subtle);
}

.section-toggle-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: 0 0 auto;
  color: var(--color-text-subtle);
}

.category-panel {
  display: grid;
  gap: 0.8rem;
}

.category-type-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  padding: 3px;
  border-radius: 10px;
  background: var(--color-surface-status);
}

.category-type-tab {
  min-height: 2rem;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 0.84rem;
}

.category-type-tab--active {
  background: var(--color-surface-nav-active);
  color: var(--color-text-main);
  font-weight: 600;
}

.category-list {
  display: grid;
  gap: 0.4rem;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: var(--color-surface);
}

.category-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 8px;
  color: #fff;
  flex: none;
}

.category-swatch-icon {
  width: 0.9rem;
  height: 0.9rem;
}

.category-name {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  color: var(--color-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-builtin-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: var(--color-surface-status);
  color: var(--color-text-soft);
  font-size: 0.72rem;
}

.category-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
}

.category-action:hover {
  background: var(--color-surface-hover-soft);
  color: var(--color-text-main);
}

.category-action--danger:hover {
  color: var(--color-text-danger);
}

.category-action-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.category-create-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.category-create-input {
  min-height: 2.3rem;
}

.category-create-button {
  min-height: 2.3rem;
  padding: 0 0.85rem;
}

.category-error {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-danger);
}

.button-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.3rem;
  padding: 0 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-accent-soft);
  border-color: var(--color-border-strong);
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.primary-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.export-button {
  width: 100%;
}

@media (max-width: 640px) {
  .picker-grid--month {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 5: 类型检查（忽略 Task 10-11 组件的缺失报错）**

Run: `npm run typecheck`
Expected: 仅剩 Task 10-11 相关缺失报错属预期

- [ ] **Step 6: Commit**

```bash
git add src/components/bills/bills-icons.ts src/components/bills/composables/useBillsSidebar.ts src/components/bills/components/BillsSidebar/
git commit -m "feat(bills): add bills sidebar with month picker, category management and export"
```

---

### Task 10: BillsPanel 明细视图与记录弹窗

**Files:**
- Create: `src/components/bills/composables/useBillsPanel.ts`
- Create: `src/components/bills/components/BillsRecordModal/BillsRecordModal.vue`
- Create: `src/components/bills/components/BillsRecordModal/BillsRecordModal.css`
- Create: `src/components/bills/components/BillsPanel/BillsPanel.vue`
- Create: `src/components/bills/components/BillsPanel/BillsPanel.css`

- [ ] **Step 1: 创建 src/components/bills/composables/useBillsPanel.ts**

```ts
import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { Bill, BillCategory } from '../../../types/bills'
import { getReadableErrorMessage } from '../../../utils/error'
import { aggregateRecords, formatCents, formatPlainCents, resolveCategory } from '../../../../electron/main/bills/logic'

export interface BillsModalState {
  open: boolean
  editing: Bill | null
}

export interface BillsRecordForm {
  date: string
  type: 'expense' | 'income' | 'transfer'
  amount: string
  category: string
  note: string
}

export function useBillsPanel(workspacePath: Ref<string | null>) {
  const selectedMonth = ref(dayjs().format('YYYY-MM'))
  const activeTab = ref<'detail' | 'stats'>('detail')
  const statsScope = ref<'month' | 'year'>('month')
  const monthRecords = ref<Bill[]>([])
  const yearRecords = ref<Bill[]>([])
  const categories = ref<BillCategory[]>([])
  const isLoading = ref(false)
  const isExporting = ref(false)
  const statusMessage = ref('')
  const sidebarStatusMessage = ref('')
  const modalState = ref<BillsModalState>({ open: false, editing: null })
  let loadSequence = 0

  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const isLoadingCategories = computed(() => false)
  const selectedYear = computed(() => selectedMonth.value.slice(0, 4))

  const detailRecords = computed(() => monthRecords.value)
  const detailSummary = computed(() => aggregateRecords(detailRecords.value, categories.value))

  const statsRecords = computed(() =>
    statsScope.value === 'month' ? monthRecords.value : yearRecords.value,
  )
  const statsSummary = computed(() => aggregateRecords(statsRecords.value, categories.value))

  watch(
    workspacePath,
    () => {
      void handleWorkspaceChange()
    },
    { immediate: true },
  )

  watch(selectedMonth, () => {
    void reloadMonthRecords()
  })

  async function handleWorkspaceChange() {
    if (!workspacePath.value) {
      monthRecords.value = []
      yearRecords.value = []
      categories.value = []
      return
    }

    await Promise.all([loadCategories(), reloadMonthRecords(), reloadYearRecords()])
  }

  async function loadCategories() {
    if (!workspacePath.value) return
    try {
      categories.value = await window.dairy.getBillCategories({ workspacePath: workspacePath.value })
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取分类失败')
    }
  }

  async function reloadMonthRecords() {
    if (!workspacePath.value) return
    const current = ++loadSequence
    try {
      const records = await window.dairy.listBillsByMonth({
        workspacePath: workspacePath.value,
        month: selectedMonth.value,
      })
      if (current === loadSequence) {
        monthRecords.value = records
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }

  async function reloadYearRecords() {
    if (!workspacePath.value) return
    try {
      yearRecords.value = await window.dairy.listBillsByYear({
        workspacePath: workspacePath.value,
        year: selectedYear.value,
      })
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }

  function openCreateModal() {
    modalState.value = { open: true, editing: null }
  }

  function openEditModal(bill: Bill) {
    modalState.value = { open: true, editing: bill }
  }

  function closeModal() {
    modalState.value = { open: false, editing: null }
  }

  async function handleRecordSaved() {
    closeModal()
    await Promise.all([reloadMonthRecords(), reloadYearRecords()])
  }

  async function handleDeleteRecord(bill: Bill) {
    if (!workspacePath.value) return
    const confirmed = window.confirm('确定删除这笔账单记录？')
    if (!confirmed) return

    try {
      await window.dairy.deleteBill({ workspacePath: workspacePath.value, id: bill.id })
      await Promise.all([reloadMonthRecords(), reloadYearRecords()])
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '删除账单失败')
    }
  }

  async function handleCategoriesChanged() {
    await loadCategories()
    await Promise.all([reloadMonthRecords(), reloadYearRecords()])
  }

  async function handleExportExcel() {
    if (!workspacePath.value || isExporting.value) return
    isExporting.value = true
    sidebarStatusMessage.value = ''
    try {
      const result = await window.dairy.exportBillsExcel({ workspacePath: workspacePath.value })
      if (result.canceled) {
        sidebarStatusMessage.value = '已取消导出'
      } else {
        sidebarStatusMessage.value = `已导出：${result.path}`
      }
    } catch (error) {
      sidebarStatusMessage.value = getReadableErrorMessage(error, '导出失败')
    } finally {
      isExporting.value = false
    }
  }

  return {
    activeTab,
    categories,
    closeModal,
    detailRecords,
    detailSummary,
    handleCategoriesChanged,
    handleDeleteRecord,
    handleExportExcel,
    handleRecordSaved,
    hasWorkspace,
    isLoading,
    isLoadingCategories,
    isExporting,
    modalState,
    monthRecords,
    openCreateModal,
    openEditModal,
    selectedMonth,
    sidebarStatusMessage,
    statsRecords,
    statsScope,
    statsSummary,
    statusMessage,
    yearRecords,
  }
}

export function toCentsFromInput(amountText: string, type: 'expense' | 'income' | 'transfer') {
  const parsed = Number.parseFloat(amountText)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('请输入有效的金额。')
  }
  const cents = Math.round(parsed * 100)
  return type === 'expense' ? -cents : cents
}

export function groupBillsByDay(records: Bill[]): Array<[string, Bill[]]> {
  const map = new Map<string, Bill[]>()
  for (const record of records) {
    const list = map.get(record.date) ?? []
    list.push(record)
    map.set(record.date, list)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

export { aggregateRecords, formatCents, formatPlainCents, resolveCategory }
```

说明：保存/编辑由弹窗组件直接调用 `window.dairy`（错误在弹窗内显示），保存成功后 emit `record-saved`，由 `handleRecordSaved` 关闭弹窗并刷新数据。`isLoading` 为简单占位（当前恒为 false，可后续扩展加载态）。

- [ ] **Step 2: 创建 BillsRecordModal.vue**

```vue
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BillCategory, BillType } from '../../../../types/bills'
import { BILL_TYPE_LABELS } from '../../../../types/bills'
import { getReadableErrorMessage } from '../../../../utils/error'
import type { BillsModalState, BillsRecordForm } from '../../composables/useBillsPanel'
import { toCentsFromInput } from '../../composables/useBillsPanel'

const props = defineProps<{
  modalState: BillsModalState
  categories: BillCategory[]
  workspacePath: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const form = reactive<BillsRecordForm>({
  date: '',
  type: 'expense',
  amount: '',
  category: '',
  note: '',
})

const errorMessage = ref('')
const isSaving = ref(false)

const typeTabs: Array<{ type: BillType; label: string }> = [
  { type: 'expense', label: BILL_TYPE_LABELS.expense },
  { type: 'income', label: BILL_TYPE_LABELS.income },
  { type: 'transfer', label: BILL_TYPE_LABELS.transfer },
]

const categoryOptions = computed(() =>
  props.categories.filter((c) => c.type === form.type),
)

watch(
  () => props.modalState.open,
  (open) => {
    if (!open) return
    const editing = props.modalState.editing
    if (editing) {
      const category = props.categories.find((c) => c.name === editing.category)
      form.date = editing.date
      form.type = category?.type ?? (editing.amountCents < 0 ? 'expense' : 'income')
      form.amount = (Math.abs(editing.amountCents) / 100).toFixed(2)
      form.category = editing.category
      form.note = editing.note
    } else {
      form.date = new Date().toISOString().slice(0, 10)
      form.type = 'expense'
      form.amount = ''
      form.category = ''
      form.note = ''
    }
    errorMessage.value = ''
  },
)

function switchType(type: BillType) {
  form.type = type
  form.category = ''
}

async function handleSubmit() {
  errorMessage.value = ''

  if (!form.date) {
    errorMessage.value = '请选择日期'
    return
  }

  let amountCents: number
  try {
    amountCents = toCentsFromInput(form.amount, form.type)
  } catch {
    errorMessage.value = '请输入有效的金额'
    return
  }

  if (!form.category) {
    errorMessage.value = '请选择分类'
    return
  }

  if (!props.workspacePath) {
    errorMessage.value = '请先选择工作区'
    return
  }

  isSaving.value = true
  try {
    if (props.modalState.editing) {
      await window.dairy.updateBill({
        workspacePath: props.workspacePath,
        id: props.modalState.editing.id,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
    } else {
      await window.dairy.createBill({
        workspacePath: props.workspacePath,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
    }
    emit('saved')
  } catch (error) {
    errorMessage.value = getReadableErrorMessage(error, '保存失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="modalState.open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card" role="dialog" aria-modal="true" :aria-label="modalState.editing ? '编辑账单' : '记一笔'">
      <header class="modal-header">
        <h3 class="modal-title">{{ modalState.editing ? '编辑账单' : '记一笔' }}</h3>
        <button class="modal-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>

      <div class="modal-body">
        <div class="type-tabs">
          <button
            v-for="tab in typeTabs"
            :key="tab.type"
            class="type-tab"
            :class="{ 'type-tab--active': form.type === tab.type }"
            type="button"
            @click="switchType(tab.type)"
          >
            {{ tab.label }}
          </button>
        </div>

        <label class="form-row">
          <span class="form-label">日期</span>
          <input v-model="form.date" class="field-input" type="date" />
        </label>

        <label class="form-row">
          <span class="form-label">金额</span>
          <div class="amount-row">
            <input
              v-model="form.amount"
              class="field-input amount-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
            />
            <span class="amount-unit">元</span>
          </div>
        </label>

        <label class="form-row">
          <span class="form-label">分类</span>
          <select v-model="form.category" class="field-input">
            <option value="" disabled>请选择分类</option>
            <option v-for="category in categoryOptions" :key="`${category.type}:${category.name}`" :value="category.name">
              {{ category.name }}
            </option>
          </select>
        </label>

        <label class="form-row">
          <span class="form-label">备注</span>
          <input v-model="form.note" class="field-input" type="text" maxlength="200" placeholder="选填" />
        </label>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      </div>

      <footer class="modal-footer">
        <button class="modal-button modal-button--ghost" type="button" @click="emit('close')">取消</button>
        <button class="modal-button modal-button--primary" type="button" :disabled="isSaving" @click="handleSubmit">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped src="./BillsRecordModal.css"></style>
```

- [ ] **Step 3: 创建 BillsRecordModal.css**

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 26, 18, 0.35);
  backdrop-filter: blur(2px);
}

.modal-card {
  width: min(420px, calc(100vw - 3rem));
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: 16px;
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-modal);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.6rem;
}

.modal-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.modal-close {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 1.2rem;
  line-height: 1;
}

.modal-close:hover {
  background: var(--color-surface-hover-soft);
  color: var(--color-text-main);
}

.modal-body {
  display: grid;
  gap: 0.85rem;
  padding: 0.5rem 1.25rem 1rem;
}

.type-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  padding: 3px;
  border-radius: 10px;
  background: var(--color-surface-status);
}

.type-tab {
  min-height: 2.1rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 0.85rem;
}

.type-tab--active {
  background: var(--color-surface-nav-active);
  color: var(--color-text-main);
  font-weight: 600;
}

.form-row {
  display: grid;
  gap: 0.4rem;
}

.form-label {
  font-size: 0.84rem;
  color: var(--color-text-subtle);
}

.field-input {
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-elevated);
  color: var(--color-text-main);
  outline: none;
  font-size: 0.92rem;
}

.field-input:focus {
  border-color: var(--color-border-strong);
}

.amount-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem;
}

.amount-input {
  font-variant-numeric: tabular-nums;
}

.amount-unit {
  color: var(--color-text-subtle);
  font-size: 0.9rem;
}

.form-error {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-danger);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.8rem 1.25rem 1.1rem;
  border-top: 1px solid var(--color-border-soft);
}

.modal-button {
  min-height: 2.3rem;
  padding: 0 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.modal-button--ghost {
  background: var(--color-surface);
  color: var(--color-text-subtle);
}

.modal-button--primary {
  background: var(--color-accent-soft);
  border-color: var(--color-border-strong);
  color: var(--color-text-main);
  font-weight: 600;
}

.modal-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```

- [ ] **Step 4: 创建 BillsPanel.vue（明细部分，统计占位）**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { Bill, BillCategory } from '../../../../types/bills'
import type { BillsModalState } from '../../composables/useBillsPanel'
import {
  aggregateRecords,
  formatCents,
  formatPlainCents,
  groupBillsByDay,
  resolveCategory,
} from '../../composables/useBillsPanel'
import { iconForName } from '../../bills-icons'
import BillsRecordModal from '../BillsRecordModal/BillsRecordModal.vue'

const props = defineProps<{
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  monthRecords: Bill[]
  yearRecords: Bill[]
  categories: BillCategory[]
  activeTab: 'detail' | 'stats'
  statsScope: 'month' | 'year'
  isLoading: boolean
  statusMessage: string
  modalState: BillsModalState
}>()

const emit = defineEmits<{
  'update:activeTab': [value: 'detail' | 'stats']
  'update:statsScope': [value: 'month' | 'year']
  openCreate: []
  openEdit: [bill: Bill]
  closeModal: []
  'record-saved': []
  deleteRecord: [bill: Bill]
}>()

const WEEK_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const detailGroups = computed(() => groupBillsByDay(props.monthRecords))
const detailSummary = computed(() => aggregateRecords(props.monthRecords, props.categories))

const yearText = computed(() => props.selectedMonth.slice(0, 4))
const monthText = computed(() => props.selectedMonth.slice(5, 7))

function dayLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = WEEK_NAMES[new Date(year, month - 1, day).getDay()]
  return `${month}月${day}日 ${weekday}`
}

function daySummary(records: Bill[]) {
  return aggregateRecords(records, props.categories)
}

function recordIconName(record: Bill): string {
  return resolveCategory(props.categories, record.amountCents, record.category).icon
}

function recordColor(record: Bill): string {
  return resolveCategory(props.categories, record.amountCents, record.category).color
}
</script>

<template>
  <section class="bills-panel">
    <div v-if="!hasWorkspace" class="bills-panel-empty">
      <h2>记账</h2>
      <p>先选择一个工作区，即可开始记录每天的收支。</p>
    </div>

    <div v-else class="bills-panel-content">
      <header class="bills-toolbar">
        <div class="bills-tabs" role="tablist">
          <button
            class="bills-tab"
            :class="{ 'bills-tab--active': activeTab === 'detail' }"
            type="button"
            role="tab"
            @click="emit('update:activeTab', 'detail')"
          >
            明细
          </button>
          <button
            class="bills-tab"
            :class="{ 'bills-tab--active': activeTab === 'stats' }"
            type="button"
            role="tab"
            @click="emit('update:activeTab', 'stats')"
          >
            统计
          </button>
        </div>
        <button class="add-button" type="button" @click="emit('openCreate')">
          <Plus class="add-button-icon" aria-hidden="true" />
          记一笔
        </button>
      </header>

      <p v-if="statusMessage" class="bills-status">{{ statusMessage }}</p>

      <template v-if="activeTab === 'detail'">
        <div class="summary-bar">
          <span>
            {{ Number(yearText) }}年{{ Number(monthText) }}月 · 共
            <strong>{{ detailSummary.count }}</strong>
            笔 · 支出 {{ formatPlainCents(detailSummary.expense) }} · 收入
            {{ formatPlainCents(detailSummary.income) }}
          </span>
        </div>

        <div v-if="detailGroups.length === 0" class="placeholder-box">本月暂无账单记录</div>

        <div v-else class="day-list">
          <article v-for="[date, records] in detailGroups" :key="date" class="day-card">
            <header class="day-header">
              <span class="day-date">{{ dayLabel(date) }}</span>
              <span class="day-sum">
                <span class="sum-expense">支出 {{ formatPlainCents(daySummary(records).expense) }}</span>
                <span class="sum-income">收入 {{ formatPlainCents(daySummary(records).income) }}</span>
              </span>
            </header>
            <hr class="day-divider" />
            <div v-for="record in records" :key="record.id" class="record-row">
              <span class="record-icon" :style="{ backgroundColor: recordColor(record) }">
                <component :is="iconForName(recordIconName(record))" class="record-icon-svg" aria-hidden="true" />
              </span>
              <div class="record-body">
                <span class="record-category">{{ record.category }}</span>
                <span v-if="record.note" class="record-note">{{ record.note }}</span>
              </div>
              <span class="record-amount" :class="record.amountCents < 0 ? 'amount-expense' : 'amount-income'">
                {{ formatCents(record.amountCents) }}
              </span>
              <span class="record-actions">
                <button class="record-action" type="button" title="编辑" aria-label="编辑" @click="emit('openEdit', record)">
                  <Pencil class="record-action-icon" aria-hidden="true" />
                </button>
                <button class="record-action record-action--danger" type="button" title="删除" aria-label="删除" @click="emit('deleteRecord', record)">
                  <Trash2 class="record-action-icon" aria-hidden="true" />
                </button>
              </span>
            </div>
          </article>
        </div>
      </template>

      <div v-else class="stats-placeholder">统计视图将在 Task 11 实现</div>
    </div>

    <BillsRecordModal
      :modal-state="modalState"
      :categories="categories"
      :workspace-path="workspacePath"
      @close="emit('closeModal')"
      @saved="emit('record-saved')"
    />
  </section>
</template>

<style scoped src="./BillsPanel.css"></style>
```

- [ ] **Step 5: 创建 BillsPanel.css**

```css
.bills-panel {
  min-height: 100%;
  display: grid;
  align-content: start;
}

.bills-panel-empty {
  display: grid;
  gap: 0.6rem;
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--color-text-subtle);
}

.bills-panel-empty h2 {
  margin: 0;
  color: var(--color-text-main);
}

.bills-panel-empty p {
  margin: 0;
}

.bills-panel-content {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.bills-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.bills-tabs {
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: var(--color-surface-status);
}

.bills-tab {
  min-height: 2.1rem;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 0.9rem;
}

.bills-tab--active {
  background: var(--color-surface-nav-active);
  color: var(--color-text-main);
  font-weight: 600;
}

.add-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.3rem;
  padding: 0 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-accent-soft);
  color: var(--color-text-main);
  font-size: 0.9rem;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.add-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.add-button-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.bills-status {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-subtle);
}

.summary-bar {
  color: var(--color-text-subtle);
  font-size: 0.88rem;
}

.summary-bar strong {
  color: var(--color-text-main);
  font-weight: 600;
}

.placeholder-box {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-text-soft);
  border: 1px dashed var(--color-border-soft);
  border-radius: 12px;
  font-size: 0.9rem;
}

.day-list {
  display: grid;
  gap: 0.9rem;
}

.day-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  background: var(--color-surface-elevated);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
}

.day-date {
  font-weight: 600;
  color: var(--color-text-main);
  font-size: 0.95rem;
}

.day-sum {
  font-size: 0.82rem;
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sum-expense {
  color: var(--color-text-danger);
  margin-right: 0.7rem;
}

.sum-income {
  color: var(--color-chart-positive);
}

.day-divider {
  border: none;
  border-top: 1px solid var(--color-border-soft);
  margin: 0.55rem 0 0.15rem;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0;
}

.record-row + .record-row {
  border-top: 1px solid var(--color-border-softest, rgba(0, 0, 0, 0.04));
}

.record-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #fff;
  flex: none;
}

.record-icon-svg {
  width: 0.95rem;
  height: 0.95rem;
}

.record-body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}

.record-category {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--color-text-main);
}

.record-note {
  color: var(--color-text-soft);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-amount {
  font-weight: 600;
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.amount-expense {
  color: var(--color-text-danger);
}

.amount-income {
  color: var(--color-chart-positive);
}

.record-actions {
  display: inline-flex;
  gap: 0.2rem;
  opacity: 0;
  transition: opacity 160ms ease;
}

.record-row:hover .record-actions {
  opacity: 1;
}

.record-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
}

.record-action:hover {
  background: var(--color-surface-hover-soft);
  color: var(--color-text-main);
}

.record-action--danger:hover {
  color: var(--color-text-danger);
}

.record-action-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.stats-placeholder {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-text-soft);
}
```

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 仅剩 Task 11 相关报错（BillsCharts 未创建）属预期

- [ ] **Step 7: Commit**

```bash
git add src/components/bills/composables/useBillsPanel.ts src/components/bills/components/BillsRecordModal/ src/components/bills/components/BillsPanel/BillsPanel.vue src/components/bills/components/BillsPanel/BillsPanel.css
git commit -m "feat(bills): add detail view and record modal"
```

---

### Task 11: 统计视图与 ECharts 图表

**Files:**
- Create: `src/components/bills/components/BillsCharts/BillsCharts.vue`
- Create: `src/components/bills/components/BillsCharts/BillsCharts.css`
- Modify: `src/components/bills/components/BillsPanel/BillsPanel.vue`（接入统计 tab）

- [ ] **Step 1: 创建 BillsCharts.vue（三个 ECharts 图表 + 主题适配）**

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Bill, BillCategory } from '../../../../types/bills'
import { aggregateRecords, formatPlainCents, resolveCategory } from '../../composables/useBillsPanel'

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  records: Bill[]
  categories: BillCategory[]
  scope: 'month' | 'year'
  selectedMonth: string
}>()

const { records, categories, scope, selectedMonth } = props

const ringEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
const windowEl = ref<HTMLElement | null>(null)
let ringChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let windowChart: echarts.ECharts | null = null
let themeObserver: MutationObserver | null = null
let resizeHandler: (() => void) | null = null

const CHART_TEXT = '#6B766D'
const CHART_SPLIT = '#EDF1EC'

const monthWindow = computed(() => {
  const [year, month] = selectedMonth.split('-').map(Number)
  const list: Array<[number, number]> = []
  let y = year
  let m = month
  for (let i = 0; i < 6; i++) {
    list.unshift([y, m])
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return list
})

const categoryExpense = computed(() => {
  const map = new Map<string, number>()
  for (const record of records) {
    const resolved = resolveCategory(categories, record.amountCents, record.category)
    if (resolved.type !== 'expense') continue
    const key = record.category
    map.set(key, (map.get(key) ?? 0) + -record.amountCents)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
})

const dailyExpense = computed(() => {
  const map = new Map<string, number>()
  for (const record of records) {
    const resolved = resolveCategory(categories, record.amountCents, record.category)
    if (resolved.type !== 'expense') continue
    map.set(record.date, (map.get(record.date) ?? 0) + -record.amountCents)
  }
  return map
})

function colorForCategory(name: string): string {
  const category = categories.find((c) => c.name === name)
  return category?.color ?? '#8B948E'
}

function readCssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function textStyle() {
  return {
    color: readCssColor('--color-text-subtle', CHART_TEXT),
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  }
}

function splitLineStyle() {
  return { lineStyle: { color: readCssColor('--color-border-soft', CHART_SPLIT) } }
}

function renderCharts() {
  if (!ringChart || !barChart || !windowChart) return

  const total = records.filter((r) => resolveCategory(categories, r.amountCents, r.category).type === 'expense').reduce((acc, r) => acc + -r.amountCents, 0)

  if (total > 0) {
    ringChart.setOption({
      title: { text: `${selectedMonth.slice(0, 4)}年${selectedMonth.slice(5, 7)}月分类支出占比`, left: 'center', top: 10, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: {
        trigger: 'item',
        textStyle: { fontSize: 13 },
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}：${(p.value / 100).toFixed(2)}（${p.percent}%）`,
      },
      legend: { bottom: 0, icon: 'circle', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 13, ...textStyle() } },
      series: [{
        type: 'pie',
        radius: ['50%', '78%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#FFFFFF', borderWidth: 2, borderRadius: 4 },
        label: { show: true, formatter: '{b} {d}%', fontSize: 12, color: readCssColor('--color-text-main', '#37433A') },
        labelLine: { length: 10, length2: 8 },
        emphasis: { scaleSize: 4, label: { show: true, formatter: '{b} {d}%', fontSize: 12 } },
        data: categoryExpense.value.map((d) => ({ name: d.name, value: Math.round((d.value / 100) * 100) / 100, itemStyle: { color: colorForCategory(d.name) } })),
      }],
    })
  } else {
    ringChart.setOption({ title: { text: '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } } })
  }

  if (scope === 'month') {
    const dayCount = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()
    const values: number[] = []
    for (let d = 1; d <= dayCount; d++) {
      const key = `${selectedMonth}-${String(d).padStart(2, '0')}`
      values.push(Math.round(((dailyExpense.value.get(key) ?? 0) / 100) * 100) / 100)
    }
    const hasData = values.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? `${selectedMonth.slice(0, 4)}年${selectedMonth.slice(5, 7)}月每日支出` : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: values.map((_, i) => `${i + 1}日`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    const windowValues = monthWindow.value.map(([y, m]) => {
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const windowLabels = monthWindow.value.map(([y, m]) => (y === Number(selectedMonth.slice(0, 4)) ? '' : `${y}年`) + `${m}月`)
    const windowHasData = windowValues.some((v) => v > 0)
    windowChart.setOption({
      title: { text: windowHasData ? '近6个月支出对比' : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: windowLabels, axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: windowValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })
  } else {
    const monthValues = Array.from({ length: 12 }, (_, i) => {
      const prefix = `${selectedMonth.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const hasData = monthValues.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? `${selectedMonth.slice(0, 4)}年月度支出` : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: monthValues.map((_, i) => `${i + 1}月`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: monthValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })
    windowChart.setOption({ title: { text: '', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } } })
  }
}

watch(() => [records, categories, scope, selectedMonth], () => {
  renderCharts()
})

onMounted(() => {
  if (ringEl.value) ringChart = echarts.init(ringEl.value)
  if (barEl.value) barChart = echarts.init(barEl.value)
  if (windowEl.value) windowChart = echarts.init(windowEl.value)

  resizeHandler = () => {
    ringChart?.resize()
    barChart?.resize()
    windowChart?.resize()
  }
  window.addEventListener('resize', resizeHandler)

  themeObserver = new MutationObserver(() => renderCharts())
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  renderCharts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler ?? (() => {}))
  themeObserver?.disconnect()
  ringChart?.dispose()
  barChart?.dispose()
  windowChart?.dispose()
  ringChart = null
  barChart = null
  windowChart = null
})
</script>

<template>
  <div class="charts-stack">
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-label">总支出</div>
        <div class="stat-value stat-expense">{{ formatPlainCents(aggregateRecords(records, categories).expense) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总收入</div>
        <div class="stat-value stat-income">{{ formatPlainCents(aggregateRecords(records, categories).income) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">结余</div>
        <div class="stat-value stat-net">{{ formatPlainCents(aggregateRecords(records, categories).net) }}</div>
      </div>
    </div>

    <div class="chart-box"><div ref="ringEl" class="chart chart--ring"></div></div>
    <div class="chart-box"><div ref="barEl" class="chart"></div></div>
    <div v-if="scope === 'month'" class="chart-box"><div ref="windowEl" class="chart"></div></div>
  </div>
</template>

<style scoped src="./BillsCharts.css"></style>
```

说明：`aggregateRecords`、`formatPlainCents`、`resolveCategory` 从 `src/components/bills/composables/useBillsPanel.ts` re-export 导入；`records`/`categories`/`scope`/`selectedMonth` 由 props 解构后在模板与 script 中直接使用。

- [ ] **Step 2: 创建 BillsCharts.css**

```css
.charts-stack {
  display: grid;
  gap: 0.9rem;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.9rem;
}

.stat-card {
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  background: var(--color-surface-elevated);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-soft);
}

.stat-value {
  font-size: 1.35rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-top: 0.3rem;
}

.stat-expense {
  color: var(--color-text-danger);
}

.stat-income {
  color: var(--color-chart-positive);
}

.stat-net {
  color: var(--color-text-main);
}

.chart-box {
  padding: 0.7rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  background: var(--color-surface-elevated);
}

.chart {
  width: 100%;
  height: 420px;
}

.chart--ring {
  height: 380px;
}

@media (max-width: 700px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart {
    height: 340px;
  }
}
```

- [ ] **Step 3: 修改 BillsPanel.vue 接入统计视图**

将 `<div v-else class="stats-placeholder">统计视图将在 Task 11 实现</div>` 替换为：

```html
      <div v-else class="stats-view">
        <div class="stats-scope-tabs">
          <button
            class="stats-scope-tab"
            :class="{ 'stats-scope-tab--active': statsScope === 'month' }"
            type="button"
            @click="emit('update:statsScope', 'month')"
          >
            本月
          </button>
          <button
            class="stats-scope-tab"
            :class="{ 'stats-scope-tab--active': statsScope === 'year' }"
            type="button"
            @click="emit('update:statsScope', 'year')"
          >
            全年
          </button>
        </div>
        <BillsCharts
          :records="statsScope === 'month' ? monthRecords : yearRecords"
          :categories="categories"
          :scope="statsScope"
          :selected-month="selectedMonth"
        />
      </div>
```

script 中 import 区加入：

```ts
import BillsCharts from '../BillsCharts/BillsCharts.vue'
```

CSS 加入（BillsPanel.css 末尾）：

```css
.stats-view {
  display: grid;
  gap: 0.9rem;
}

.stats-scope-tabs {
  display: inline-flex;
  justify-self: start;
  padding: 3px;
  border-radius: 10px;
  background: var(--color-surface-status);
}

.stats-scope-tab {
  min-height: 2.1rem;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 0.9rem;
}

.stats-scope-tab--active {
  background: var(--color-surface-nav-active);
  color: var(--color-text-main);
  font-weight: 600;
}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（若 echarts 类型报错，确认 `echarts/core` 的类型导入路径正确）

- [ ] **Step 5: 运行全部单测**

Run: `npm run test`
Expected: PASS（logic + export）

- [ ] **Step 6: Commit**

```bash
git add src/components/bills/components/BillsCharts/ src/components/bills/components/BillsPanel/BillsPanel.vue src/components/bills/components/BillsPanel/BillsPanel.css
git commit -m "feat(bills): add stats view with echarts charts"
```

---

### Task 12: AGENTS.md 更新与全量验证

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 AGENTS.md**

1. 「当前产品状态」已具备列表追加：

```markdown
- 记账：月度明细/统计视图、录入编辑删除、分类库（内置+自定义）、导出 Excel（sheet 按年份）
```

2. 「推荐工作区结构」示例更新（`bills/` 与 `journal/` 同级、`.dairy/bill-categories.json`）：

```text
workspace/
  journal/YYYY/MM/YYYY-MM-DD.md
  bills/bills.db
  reports/
  .dairy/
    workspace.json
    tags.json
    weather.json
    locations.json
    bill-categories.json
    user-profile.md
    supplement.md
```

3. 「架构边界」渲染/主进程职责补充：主进程负责记账数据读写与 Excel 导出；preload API 保持最小。

4. 「关键规则」补充记账约定：

```markdown
- 记账数据存 <workspace>/bills/bills.db（SQLite，better-sqlite3 原生模块，打包需 asarUnpack）
- 分类库存 <workspace>/.dairy/bill-categories.json（物理删除，历史账单按金额符号兜底到对应类型「其他」样式）
- 金额以「分」整数存储（amount_cents），UI 显示保留 2 位小数
- 记账统计在前端聚合（list-year + 分类解析三步匹配），transfer 类型（理财等）不计入收支统计
```

5. 「当前优先级」追加：

```markdown
- 记账主流程（录入/浏览/统计/导出）稳定可用
```

- [ ] **Step 2: 全量类型检查与单测**

Run: `npm run typecheck && npm run test`
Expected: 全部通过

- [ ] **Step 3: 生产构建**

Run: `npm run build`
Expected: vue-tsc 通过、vite 构建成功、electron-builder 产出安装包（better-sqlite3 已编译进包）

- [ ] **Step 4: 手动验证清单（npm run dev）**

- [ ] 左侧 ActivityBar 出现「记账」图标，点击进入记账页
- [ ] 未选择工作区时显示引导提示
- [ ] 选择工作区后：分类 JSON 首次播种 18 个内置分类；`bills/bills.db` 创建
- [ ] 月份选择器可切换年份/月份，「回到本月」正常
- [ ] 「记一笔」：支出/收入/不计入切换、金额校验、分类下拉过滤、保存后明细出现且汇总条更新
- [ ] 编辑：hover 行出现编辑/删除按钮，编辑保存后更新
- [ ] 删除：确认弹窗后记录消失
- [ ] 统计 tab：本月/全年切换、三卡片数值、环形图/柱状图/近6月对比渲染正常；无数据时显示「暂无支出数据」
- [ ] 深色主题切换后图表颜色跟随更新
- [ ] 分类管理：新增自定义分类（自动分配颜色）、重命名、删除（确认提示）、内置分类只读
- [ ] 删除分类后，历史账单文字保留、样式回退为「其他」色
- [ ] 导出 Excel：弹出保存对话框，导出文件 sheet 按年份命名、列与 header 正确；取消时静默返回
- [ ] 日记/报告/时间轴等其他视图不受影响

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with bills feature conventions"
```

