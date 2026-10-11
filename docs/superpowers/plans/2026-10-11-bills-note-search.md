# 记账备注搜索实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给记账「明细」tab 加一个常驻搜索框：回车后跨全部历史搜索备注，分批加载（每批 30 条、按日边界对齐），结果可打开编辑弹窗；保存/删除/复制后不重查数据库、就地更新列表与统计。

**Architecture:** 纯逻辑（匹配/高亮/贡献/改名/搜索窗口就地更新 reducer）下沉 `src/shared/bills-logic.ts` 并 TDD；主进程新增 `bills:search`（SQL LIKE + LIMIT/OFFSET 分页 + iterate 流式汇总 + 日边界对齐）；渲染层 `useBillsPanel` 持有搜索窗口、分页函数与竞态守卫；`BillsPanel` 渲染搜索态 UI；`AppShellPage` / `useAppShell` 负责导航退出与 Ctrl+F。

**Tech Stack:** Electron + Vue 3 + TypeScript + Vite + better-sqlite3 + Vitest

**Spec:** `docs/superpowers/specs/2026-10-11-bills-note-search-design.md`（执行时与计划对照阅读）

## Global Constraints

- 搜索只匹配备注（不搜分类/金额/日期）；关键词 trim、ASCII 不区分大小写；命中词高亮
- 批大小 `BILLS_SEARCH_PAGE_SIZE = 30`；取数按日边界对齐（返回条数可略多于 30）
- 统计（`total`/收入/支出）恒定镜像全部匹配集，单位「分」；transfer 不计入收支（与 `aggregateRecords` 同口径）
- 弹窗操作后就地更新，不重查数据库；`total−1` 仅发生在删除或改到不再匹配
- 渲染进程不直接访问文件系统；`preload` 只暴露显式 API；IPC 传可结构化克隆的普通对象
- db 层 / service 层不写单测（better-sqlite3 为 Electron ABI 编译产物）；可测逻辑下沉 `src/shared/bills-logic.ts`
- 用户可见文案简洁中文；样式只用主题 token（`var(--...)`），不硬编码颜色
- 不改 MCP `queryBills`、Excel 导出、统计 tab；除 Ctrl+F 外不加其他快捷键
- 提交信息：英文前缀 + 中文内容（如 `feat(bills): ...`）；Windows 下 npm 命令优先通过 cmd 执行

## Review Focus（spec 隐含、最容易被忽略的输入/场景，及对应保障）

1. **中文输入法组合态下的回车/Esc** → 只应确认候选词，不该提交搜索或清空；由 Task 6 的 `isComposing` 守卫实现，Task 7 验收 #3 检查
2. **同一天多条记录跨批次被切开** → 日期组小计必须完整；Task 3 的日边界对齐实现，Task 7 验收 #8 检查
3. **备注含 `%` `_` `\` 等字符** → 本地匹配按字面量、服务端复用 `escapeLikeKeyword` 转义，两端行为一致；Task 1 测试覆盖
4. **就地更新后继续「查看更多」不漏不重**（`offset = 已加载条数` 不变式）→ Task 2 测试覆盖，Task 7 验收 #6/#7 检查
5. **纯空白关键词 / 切页残留输入 / 在途响应竞态** → trim 后空即退出、退出清输入、序列号守卫；Task 4 实现，Task 7 验收 #4/#5 检查

---

## 任务一览

| # | 任务 | 提交信息 |
|---|------|---------|
| 1 | 搜索基础纯逻辑（匹配/高亮/贡献/改名）+ 单测 | `feat(bills): 新增备注搜索基础纯逻辑与单测` |
| 2 | 搜索窗口就地更新 reducer + 相关类型 | `feat(bills): 新增搜索窗口就地更新纯逻辑` |
| 3 | bills:search IPC 链路与 service（含日边界对齐） | `feat(bills): 新增 bills:search IPC 链路与 service` |
| 4 | useBillsPanel 搜索状态与函数 | `feat(bills): 面板 composable 接入搜索状态与就地更新` |
| 5 | 弹窗保存结果与侧栏分类变更 payload | `feat(bills): 弹窗与分类事件携带变更 payload` |
| 6 | BillsPanel 搜索 UI + AppShell 接线（Ctrl+F、导航退出） | `feat(bills): 明细页新增全局备注搜索并接入 Ctrl+F` |
| 7 | 文档同步与全量验证 | `docs(bills): 同步备注搜索文档与变更日志` |

---

## Task 1: 搜索基础纯逻辑（TDD）

**Files:**
- Modify: `src/shared/bills-logic.ts`（文件末尾追加）
- Test: `tests/bills/search.test.ts`（新建）

**Interfaces:**
- Consumes: 现有 `resolveCategory`（同文件）。
- Produces（后续任务按此签名使用）:
  - `BILLS_SEARCH_PAGE_SIZE = 30`
  - `billMatchesKeyword(note: string, keyword: string): boolean`
  - `splitNoteByKeyword(note: string, keyword: string): Array<{ text: string; hit: boolean }>`
  - `billSearchContribution(categories: BillCategory[], bill: Bill): { income: number; expense: number }`
  - `applyCategoryRenameToBill(bill: Bill, rename: { type: BillType; oldName: string; newName: string }): Bill`

- [ ] **Step 1: 写失败测试**

创建 `tests/bills/search.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/bills/search.test.ts`
Expected: FAIL —— `bills-logic` 尚未导出 `billMatchesKeyword` / `splitNoteByKeyword` / `billSearchContribution` / `applyCategoryRenameToBill` / `BILLS_SEARCH_PAGE_SIZE`

- [ ] **Step 3: 实现 `src/shared/bills-logic.ts`（文件末尾追加）**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/bills/search.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/shared/bills-logic.ts tests/bills/search.test.ts
git commit -m "feat(bills): 新增备注搜索基础纯逻辑与单测"
```

---

## Task 2: 搜索窗口就地更新 reducer（TDD）

**Files:**
- Modify: `src/types/bills.ts`（在 `BillsQueryResult` 定义之后插入）
- Modify: `src/shared/bills-logic.ts`（文件末尾追加）
- Modify: `tests/bills/search.test.ts`（追加）

**Interfaces:**
- Consumes: Task 1 的 `billMatchesKeyword` / `billSearchContribution`。
- Produces:
  - 类型 `BillsSearchWindow` / `BillsSavedPayload` / `BillsSearchMutation` / `BillsCategoryChange`（Task 3/4/5/6 使用）
  - `applyBillsMutation(window: BillsSearchWindow, mutation: BillsSearchMutation, categories: BillCategory[], keyword: string): { window: BillsSearchWindow; needsRefill: boolean }`（Task 4 使用）

- [ ] **Step 1: 写失败测试**

先修改 `tests/bills/search.test.ts` 的 import 块为：

```ts
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
```

在文件末尾追加：

```ts
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
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/bills/search.test.ts`
Expected: FAIL —— `applyBillsMutation` 不存在、`BillsSearchWindow` 类型未定义

- [ ] **Step 3: 在 `src/types/bills.ts` 的 `BillsQueryResult` 定义之后插入类型**

（IPC 输入/输出类型 `BillsSearchInput` / `BillsSearchResult` 留到 Task 3 补充，本步骤只加入搜索态窗口与变更 payload。）

```ts
// ===== 备注搜索 =====

// 搜索态已加载窗口（渲染层状态，纯逻辑复用）
export interface BillsSearchWindow {
  records: Bill[]
  total: number
  income: number
  expense: number
}

// 弹窗保存结果（BillsRecordModal → BillsPanel → AppShell → useBillsPanel）
export type BillsSavedPayload =
  | { kind: 'create'; bill: Bill }
  | { kind: 'duplicate'; bill: Bill }
  | { kind: 'update'; previous: Bill; bill: Bill }

// 搜索态下要应用的就地变更（= 保存类 + 删除）
export type BillsSearchMutation = BillsSavedPayload | { kind: 'delete'; bill: Bill }

// 侧栏分类变更（用于重命名的就地改名与统计刷新）
export type BillsCategoryChange =
  | { kind: 'create'; type: BillType; name: string }
  | { kind: 'rename'; type: BillType; oldName: string; newName: string }
  | { kind: 'delete'; type: BillType; name: string }
```

- [ ] **Step 4: 实现 `applyBillsMutation`（`src/shared/bills-logic.ts` 末尾追加）**

注意：文件头部 `import` 的类型列表需追加 `BillsSearchMutation`、`BillsSearchWindow`。

```ts
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test -- tests/bills/search.test.ts`
Expected: 全部 PASS（含 Task 1 的用例）

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add src/types/bills.ts src/shared/bills-logic.ts tests/bills/search.test.ts
git commit -m "feat(bills): 新增搜索窗口就地更新纯逻辑"
```

---

## Task 3: bills:search IPC 链路与 service

**Files:**
- Modify: `src/types/bills.ts`（追加 `BillsSearchInput` / `BillsSearchResult`……注意本任务只需这两个类型，其余 Task 2 已加）
- Modify: `src/shared/ipc-channels.ts`（bills 区块）
- Modify: `electron/main/bills/service.ts`
- Modify: `electron/main/ipc/bills.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/api.ts`

**Interfaces:**
- Consumes: `billSearchContribution`（Task 1）、现有 `escapeLikeKeyword` / `mapRowToBill` / `withExistingBillsDatabase` / `getBillCategories`。
- Produces:
  - channel `searchBills: 'bills:search'`
  - `searchBills(input: BillsSearchInput): Promise<BillsSearchResult>`（service）
  - `window.dairy.searchBills(input) => Promise<BillsSearchResult>`（Task 4 使用）

- [ ] **Step 1: `src/types/bills.ts` 追加 `BillsSearchInput` / `BillsSearchResult`**

放在 Task 2 新增的「备注搜索」类型块内（`BillsSearchWindow` 之前）：

```ts
export interface BillsSearchInput {
  workspacePath: string
  keyword: string
  offset: number
  limit: number
}

export interface BillsSearchResult {
  records: Bill[] // 当前页（已按日边界对齐）
  total: number // 全部匹配数
  income: number // 全量口径，分（transfer 不计）
  expense: number // 全量口径，分
}
```

- [ ] **Step 2: `src/shared/ipc-channels.ts` 新增通道**

在 bills 区块 `listBillsMonths: 'bills:list-months',` 之后加一行：

```ts
  searchBills: 'bills:search',
```

- [ ] **Step 3: `electron/main/bills/service.ts` 新增 `searchBills`**

import 调整：
- 类型 import 增加 `BillsSearchInput`、`BillsSearchResult`；
- `bills-logic` import 增加 `billSearchContribution`。

在 `queryBills` 之后（或 `escapeLikeKeyword` 附近）新增：

```ts
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
      .all(like, limit + 1, offset) as BillRow[]
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
```

- [ ] **Step 4: `electron/main/ipc/bills.ts` 注册 handler**

- 类型 import 增加 `BillsSearchInput`；
- service import 增加 `searchBills`；
- 在 `listBillsMonths` handler 之后新增：

```ts
  ipcMain.handle(IPC_CHANNELS.searchBills, (_event, input: BillsSearchInput) => searchBills(input))
```

- [ ] **Step 5: `electron/preload.ts` 新增 API**

在 `listBillsMonths` 一行之后新增：

```ts
  searchBills: (input) => ipcRenderer.invoke(IPC_CHANNELS.searchBills, input),
```

- [ ] **Step 6: `src/types/api.ts` 补类型与接口**

- 类型 import 块（`./bills`）增加 `BillsSearchInput`、`BillsSearchResult`；
- `DairyApi` 接口在 `listBillsMonths` 之后新增：

```ts
  searchBills: (input: BillsSearchInput) => Promise<BillsSearchResult>
```

- [ ] **Step 7: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 8（可选）: 启动应用做一次接口冒烟**

Run: `npm run dev`，DevTools 控制台执行：

```js
await window.dairy.searchBills({ workspacePath: '<你的工作区路径>', keyword: '鼠标', offset: 0, limit: 30 })
```

Expected: 返回 `{ records, total, income, expense }`；`records` 按 `date DESC, id DESC` 排序，末日记录完整。

- [ ] **Step 9: 提交**

```bash
git add src/types/bills.ts src/shared/ipc-channels.ts electron/main/bills/service.ts electron/main/ipc/bills.ts electron/preload.ts src/types/api.ts
git commit -m "feat(bills): 新增 bills:search IPC 链路与 service"
```

---

## Task 4: useBillsPanel 搜索状态与函数

**Files:**
- Modify: `src/components/bills/composables/useBillsPanel.ts`

**Interfaces:**
- Consumes: Task 2 的 `applyBillsMutation` / 类型、Task 1 的 `BILLS_SEARCH_PAGE_SIZE` / `applyCategoryRenameToBill`、Task 3 的 `window.dairy.searchBills`。
- Produces（composable 导出，Task 6 使用）:
  - 状态：`searchInput`、`searchKeyword`、`searchWindow`、`isSearchLoading`、`isSearchLoadingMore`、`searchErrorMessage`
  - 函数：`submitSearch()`、`loadMoreSearch()`、`exitSearch()`
  - 变更的既有函数：`handleRecordSaved(payload)`、`handleDeleteFromModal()`、`handleDeleteRecord(bill)`、`handleCategoriesChanged(change?)`、`handleWorkspaceChange()`
  - 末尾 re-export 增加 `splitNoteByKeyword`（Task 6 的组件从本文件导入）

- [ ] **Step 1: 调整 import 与 re-export**

```ts
import type {
  Bill,
  BillCategory,
  BillsCategoryChange,
  BillsChartJumpPayload,
  BillsSavedPayload,
  BillsSearchMutation,
  BillsSearchWindow,
  BillsWindowTotal,
} from '../../../types/bills'
```

`../../../shared/bills-logic` 的 import 增加：`applyBillsMutation`、`applyCategoryRenameToBill`、`BILLS_SEARCH_PAGE_SIZE`、`splitNoteByKeyword`。

文件末尾 re-export 行改为：

```ts
export { aggregateRecords, formatCents, formatPlainCents, resolveCategory, splitNoteByKeyword }
```

- [ ] **Step 2: 插入搜索状态与函数块**

插在 `handleChartJump` 之后、`watch(workspacePath, ...)` 之前（**必须在 watch 之前**：`handleWorkspaceChange` 会调用 `exitSearch`）。

```ts
  // ===== 备注搜索 =====

  const searchInput = ref('')
  const searchKeyword = ref('')
  const searchWindow = ref<BillsSearchWindow>({ records: [], total: 0, income: 0, expense: 0 })
  const isSearchLoading = ref(false)
  const isSearchLoadingMore = ref(false)
  const searchErrorMessage = ref('')
  // 搜索相关异步响应的竞态守卫（沿用 loadSequence 模式）
  let searchSequence = 0

  function resetSearchWindow() {
    searchWindow.value = { records: [], total: 0, income: 0, expense: 0 }
  }

  // 退出搜索（幂等）：清关键词/输入/窗口/加载态；浏览状态（月份/年度/筛选）保持不动
  function exitSearch() {
    searchSequence += 1
    searchKeyword.value = ''
    searchInput.value = ''
    resetSearchWindow()
    isSearchLoading.value = false
    isSearchLoadingMore.value = false
    searchErrorMessage.value = ''
  }

  async function submitSearch() {
    if (!workspacePath.value || isSearchLoading.value) return
    const keyword = searchInput.value.trim()
    if (!keyword) {
      exitSearch()
      return
    }

    searchKeyword.value = keyword
    resetSearchWindow()
    searchErrorMessage.value = ''
    isSearchLoading.value = true
    isSearchLoadingMore.value = false
    const current = ++searchSequence

    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword,
        offset: 0,
        limit: BILLS_SEARCH_PAGE_SIZE,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        records: result.records,
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch (error) {
      if (current !== searchSequence) return
      searchErrorMessage.value = getReadableErrorMessage(error, '搜索失败')
    } finally {
      if (current === searchSequence) {
        isSearchLoading.value = false
      }
    }
  }

  async function loadMoreSearch() {
    if (!workspacePath.value || !searchKeyword.value) return
    if (isSearchLoading.value || isSearchLoadingMore.value) return
    if (searchWindow.value.total <= searchWindow.value.records.length) return

    const current = searchSequence
    isSearchLoadingMore.value = true
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: BILLS_SEARCH_PAGE_SIZE,
      })
      if (current !== searchSequence) return
      // 追加并直接采用响应中的全量统计（顺带修正任何漂移）
      searchWindow.value = {
        records: [...searchWindow.value.records, ...result.records],
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 加载更多失败静默：保持已加载列表，用户可再次点击重试
    } finally {
      if (current === searchSequence) {
        isSearchLoadingMore.value = false
      }
    }
  }

  async function refillSearchWindow() {
    if (!workspacePath.value || !searchKeyword.value || isSearchLoadingMore.value) return

    const current = searchSequence
    isSearchLoadingMore.value = true
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: 1,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        ...searchWindow.value,
        records: [...searchWindow.value.records, ...result.records],
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 补位失败静默：窗口暂时少一条，offset 不变式不受影响
    } finally {
      if (current === searchSequence) {
        isSearchLoadingMore.value = false
      }
    }
  }

  async function refreshSearchSummary() {
    if (!workspacePath.value || !searchKeyword.value) return

    const current = searchSequence
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: 1,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        ...searchWindow.value,
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 统计刷新失败静默：下次取数时修正
    }
  }

  function applySearchMutation(mutation: BillsSearchMutation) {
    if (!searchKeyword.value) return
    const next = applyBillsMutation(searchWindow.value, mutation, categories.value, searchKeyword.value)
    searchWindow.value = next.window
    if (next.needsRefill) {
      void refillSearchWindow()
    }
  }
```

- [ ] **Step 3: 改造既有函数**

`handleRecordSaved`（先就地更新，再并行重载浏览数据）：

```ts
  async function handleRecordSaved(payload: BillsSavedPayload) {
    closeModal()
    applySearchMutation(payload)
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
  }
```

`handleDeleteRecord`：删除成功后、`await Promise.all(...)` 之前加一行 `applySearchMutation({ kind: 'delete', bill })`。

`handleDeleteFromModal`：`closeModal()` 之后、`await Promise.all(...)` 之前加一行 `applySearchMutation({ kind: 'delete', bill })`。

`handleCategoriesChanged`：

```ts
  async function handleCategoriesChanged(change?: BillsCategoryChange) {
    await loadCategories()
    if (searchKeyword.value) {
      if (change?.kind === 'rename') {
        searchWindow.value = {
          ...searchWindow.value,
          records: searchWindow.value.records.map((bill) => applyCategoryRenameToBill(bill, change)),
        }
      }
      // 分类增删改会改变 resolveCategory 的解析口径，必须静默刷新全量统计
      void refreshSearchSummary()
    }
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
  }
```

`handleWorkspaceChange`：函数体第一行加 `exitSearch()`（幂等；无工作区分支与正常分支都会先清搜索态）。

- [ ] **Step 4: 补充 return 导出**

在 return 对象中补充（跟随现有排列习惯）：`exitSearch`、`isSearchLoading`、`isSearchLoadingMore`、`loadMoreSearch`、`searchErrorMessage`、`searchInput`、`searchKeyword`、`searchWindow`、`submitSearch`。

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（Task 6 之前没有调用方，属正常）

- [ ] **Step 6: 提交**

```bash
git add src/components/bills/composables/useBillsPanel.ts
git commit -m "feat(bills): 面板 composable 接入搜索状态与就地更新"
```

---

## Task 5: 弹窗与侧栏分类事件携带 payload

**Files:**
- Modify: `src/components/bills/components/BillsRecordModal/BillsRecordModal.vue`
- Modify: `src/components/bills/composables/useBillsSidebar.ts`

**Interfaces:**
- Consumes: Task 2 的 `BillsSavedPayload` / `BillsCategoryChange`。
- Produces:
  - `BillsRecordModal`：`saved: [payload: BillsSavedPayload]`（`kind` 为 `create` / `duplicate` / `update`）
  - `useBillsSidebar` / `BillsSidebar`：`categoryChanged: [change: BillsCategoryChange]`

- [ ] **Step 1: 修改 `BillsRecordModal.vue`**

- 类型 import 增加 `BillsSavedPayload`；
- emits 改为：

```ts
const emit = defineEmits<{
  close: []
  saved: [payload: BillsSavedPayload]
  deleted: []
}>()
```

- `handleSubmit` 的写入分支改为（捕获返回值并携带 previous；其余校验逻辑不动）：

```ts
    if (props.modalState.editing) {
      const previous = props.modalState.editing
      const bill = await window.dairy.updateBill({
        workspacePath: props.workspacePath,
        id: previous.id,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
      emit('saved', { kind: 'update', previous, bill })
    } else {
      const bill = await window.dairy.createBill({
        workspacePath: props.workspacePath,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
      emit('saved', { kind: 'create', bill })
    }
```

- `handleDuplicate` 的写入改为：

```ts
    const bill = await window.dairy.createBill({
      workspacePath: props.workspacePath,
      date: getJournalDateText(props.dayStartHour),
      amountCents,
      category: form.category,
      note: form.note.trim(),
    })
    emit('saved', { kind: 'duplicate', bill })
```

- [ ] **Step 2: 修改 `useBillsSidebar.ts`**

- 类型 import 增加 `BillsCategoryChange`；
- emits 类型改为：

```ts
export type BillsSidebarEmits = {
  'update:selectedMonth': [value: string]
  'update:selectedYear': [value: number]
  'update:statsMode': [value: 'month' | 'year']
  categoryChanged: [change: BillsCategoryChange]
  export: []
}
```

- 三处 emit 改为：

```ts
      emit('categoryChanged', { kind: 'create', type: categoryPanelTab.value, name })
```

```ts
      emit('categoryChanged', { kind: 'rename', type: state.type, oldName: state.name, newName: newName.trim() })
```

```ts
      emit('categoryChanged', { kind: 'delete', type, name })
```

（`newName.trim()` 与主进程 `renameBillCategory` 的落盘值一致。）

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（AppShell 现有 no-arg 处理器与新事件兼容，任务 6 再更新）

- [ ] **Step 4: 提交**

```bash
git add src/components/bills/components/BillsRecordModal/BillsRecordModal.vue src/components/bills/composables/useBillsSidebar.ts
git commit -m "feat(bills): 弹窗与分类事件携带变更 payload"
```

---

## Task 6: BillsPanel 搜索 UI + AppShell 接线

**Files:**
- Modify: `src/components/bills/components/BillsPanel/BillsPanel.vue`
- Modify: `src/components/bills/components/BillsPanel/BillsPanel.css`
- Modify: `src/app/pages/AppShellPage.vue`
- Modify: `src/app/composables/useAppShell.ts`

**Interfaces:**
- Consumes: Task 4 的 composable 导出与 Task 5 的 payload。
- Produces:
  - BillsPanel 新 props：`searchInput`、`searchKeyword`、`searchRecords`、`searchTotal`、`searchIncome`、`searchExpense`、`isSearchLoading`、`isSearchLoadingMore`、`searchErrorMessage`
  - BillsPanel 新 emits：`update:searchInput`、`search-submit`、`search-clear`、`search-load-more`；`record-saved` 改为携带 `BillsSavedPayload`
  - BillsPanel `defineExpose({ focusSearchInput })`
  - AppShell `billsPanelRef` + `handleGlobalKeydown` 的 bills 分支

- [ ] **Step 1: `BillsPanel.vue` script 调整**

import 调整：

```ts
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, Search, X } from 'lucide-vue-next'
import type { Bill, BillCategory, BillsSavedPayload, BillsWindowTotal } from '../../../../types/bills'
```

从 composable 的 import 增加 `splitNoteByKeyword`。

props 增加（追加到 `defineProps` 类型中）：

```ts
  searchInput: string
  searchKeyword: string
  searchRecords: Bill[]
  searchTotal: number
  searchIncome: number
  searchExpense: number
  isSearchLoading: boolean
  isSearchLoadingMore: boolean
  searchErrorMessage: string
```

emits 增加／修改：

```ts
  'update:searchInput': [value: string]
  'search-submit': []
  'search-clear': []
  'search-load-more': []
  'record-saved': [payload: BillsSavedPayload]
```

computed 替换/新增（替换现有 `detailGroups`）：

```ts
const isSearching = computed(() => props.searchKeyword !== '')
const searchRemaining = computed(() => Math.max(0, props.searchTotal - props.searchRecords.length))
const hasMoreSearch = computed(() => isSearching.value && searchRemaining.value > 0)
const displayedGroups = computed(() =>
  groupBillsByDay(isSearching.value ? props.searchRecords : props.renderedRecords),
)
const showDayList = computed(() =>
  isSearching.value
    ? !props.isSearchLoading && props.searchErrorMessage === '' && props.searchRecords.length > 0
    : hasAnyRecords.value,
)
const showSearchEnterHint = computed(
  () => props.searchInput.trim() !== '' && props.searchInput.trim() !== props.searchKeyword,
)
```

函数新增：

```ts
const searchInputElement = ref<HTMLInputElement | null>(null)

function dayLabelWithYear(date: string) {
  const [year] = date.split('-').map(Number)
  const label = dayLabel(date)
  return year === new Date().getFullYear() ? label : `${year}年${label}`
}

function dayLabelFor(date: string) {
  return isSearching.value ? dayLabelWithYear(date) : dayLabel(date)
}

function noteSegments(note: string) {
  return isSearching.value
    ? splitNoteByKeyword(note, props.searchKeyword)
    : [{ text: note, hit: false }]
}

function onSearchInput(event: Event) {
  emit('update:searchInput', (event.target as HTMLInputElement).value)
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  emit('search-submit')
}

function handleSearchEscape(event: KeyboardEvent) {
  if (event.isComposing) return
  emit('search-clear')
}

// Ctrl+F 聚焦入口：非明细 tab 或记账弹窗打开时不动作
function focusSearchInput() {
  if (props.activeTab !== 'detail' || props.modalState.open) return
  const input = searchInputElement.value
  if (!input) return
  input.focus()
  input.select()
}

defineExpose({ focusSearchInput })
```

- [ ] **Step 2: `BillsPanel.vue` template 调整**

工具栏：`add-button` 外包一层尾部容器，并加入搜索框（`activeTab === 'detail'` 才渲染）：

```html
        <div class="bills-toolbar-tail">
          <div v-if="activeTab === 'detail'" class="search-field">
            <Search class="search-field-icon" aria-hidden="true" />
            <input
              ref="searchInputElement"
              class="search-input"
              type="text"
              placeholder="全局搜索"
              aria-label="全局搜索备注"
              :value="searchInput"
              @input="onSearchInput"
              @keydown.enter="handleSearchEnter"
              @keydown.esc="handleSearchEscape"
            />
            <span v-if="showSearchEnterHint" class="search-enter-hint" aria-hidden="true">⏎</span>
            <button
              v-if="searchInput !== ''"
              class="search-clear"
              type="button"
              aria-label="清除搜索"
              @click="emit('search-clear')"
            >
              <X class="search-clear-icon" aria-hidden="true" />
            </button>
          </div>
          <button v-if="activeTab === 'detail'" class="add-button" type="button" @click="emit('openCreate')">
            <Plus class="add-button-icon" aria-hidden="true" />
            记一笔
          </button>
        </div>
```

摘要条：搜索态与浏览态互斥（浏览态原样保留）：

```html
        <div v-if="isSearching" class="summary-bar summary-bar--search">
          <span v-if="isSearchLoading">搜索「{{ searchKeyword }}」 · 搜索中…</span>
          <span v-else>
            <span class="search-chip">搜索「{{ searchKeyword }}」</span>
            全部时间 · 共 <strong>{{ searchTotal }}</strong> 笔 · 支出
            <span class="summary-expense">{{ formatPlainCents(searchExpense) }}</span> · 收入
            <span class="summary-income">{{ formatPlainCents(searchIncome) }}</span>
          </span>
          <button class="summary-clear" type="button" @click="emit('search-clear')">清除</button>
        </div>
        <div v-else class="summary-bar">
          <!-- 现有内容原样不动 -->
        </div>
```

占位区（替换现有单个 `v-if="!hasAnyRecords"` 的占位）：

```html
        <div v-if="isSearching && isSearchLoading" class="placeholder-box">正在搜索…</div>
        <div v-else-if="isSearching && searchErrorMessage" class="placeholder-box">
          {{ searchErrorMessage }}
        </div>
        <div v-else-if="isSearching && searchRecords.length === 0" class="placeholder-box">
          没有找到包含「{{ searchKeyword }}」的账单
        </div>
        <div v-else-if="!isSearching && !hasAnyRecords" class="placeholder-box">
          <!-- 现有浏览态空文案逻辑原样保留 -->
        </div>
```

列表（参数化现有 day-list，单一来源；`detailGroups` 已替换为 `displayedGroups`）：
- `v-if="showDayList"`；
- 日期标题：`{{ dayLabelFor(date) }}`；
- 备注渲染：

```html
                <span v-if="record.note" class="record-note">
                  <span
                    v-for="(segment, index) in noteSegments(record.note)"
                    :key="index"
                    :class="{ 'note-hit': segment.hit }"
                  >{{ segment.text }}</span>
                </span>
```

- 新搜索回顶部：加载态占位（`isSearching && isSearchLoading`）会卸载 day-list，响应返回后列表重建、`scrollTop` 自然归零——无需额外滚动代码；Task 7 验收第 1 条确认。
- 「查看更多」按钮改为：

```html
          <button
            v-if="isSearching ? hasMoreSearch : hasMoreMonths"
            class="load-more-button"
            type="button"
            :disabled="isSearching && isSearchLoadingMore"
            @click="isSearching ? emit('search-load-more') : emit('load-more')"
          >
            {{ isSearching
              ? (isSearchLoadingMore ? '加载中…' : `查看更多（剩余 ${searchRemaining} 笔）`)
              : `查看更多（剩余 ${remainingMonthCount} 个月）` }}
          </button>
```

弹窗事件透传：`@saved="emit('record-saved', $event)"`。

- [ ] **Step 3: `BillsPanel.css` 追加样式**

新增类（具体尺寸/圆角随现有控件视觉微调；颜色一律用主题 token，深色主题不新增特判）：

- `.bills-toolbar-tail`：`display:flex; align-items:center; gap:.6rem; margin-left:auto`（搜索框 + 记一笔整体靠右）
- `.search-field`：输入框容器（flex 居中；`min-height:2.3rem`；1px `var(--color-border-soft)` 边框、圆角 10px、`var(--color-surface-elevated)` 背景；`:focus-within` 边框换 `var(--color-border-strong)`）
- `.search-field-icon`：约 0.95rem，`var(--color-text-subtle)`
- `.search-input`：约 11rem 宽、透明背景无边框、`var(--color-text-main)`；placeholder 用 `var(--color-text-soft)`
- `.search-enter-hint`：回车小徽标（`var(--color-surface-status)` 背景、`var(--color-text-subtle)` 文字、圆角 6px、字号 0.75rem）
- `.search-clear` / `.search-clear-icon`：清除钮（约 1.4rem 圆形、透明背景、`var(--color-text-subtle)`；hover 背景 `var(--color-surface-hover-soft)`、文字 `var(--color-text-main)`）
- `.summary-clear`：摘要条「清除」文字按钮（无边框透明背景、`var(--color-accent-strong)`；hover 文字 `var(--color-text-main)`）
- `.search-chip`：摘要条中搜索关键词的强调样式（`var(--color-text-main)` + 600 字重）
- `.note-hit`：命中高亮（`var(--color-accent-soft)` 背景、`var(--color-accent-strong)` 文字、圆角 4px、600 字重）
- `.load-more-button:disabled`：禁用态（`cursor:default`、`var(--color-text-subtle)`）

- [ ] **Step 4: `AppShellPage.vue` script**

- 类型 import 增加：

```ts
import type { BillsCategoryChange, BillsSavedPayload } from '../../types/bills'
```

- 新增 ref 与处理器：

```ts
const billsPanelRef = ref<InstanceType<typeof BillsPanel> | null>(null)

function handleBillsRecordSaved(payload: BillsSavedPayload) {
  billsSidebarRefreshTick.value += 1
  void billsPanel.handleRecordSaved(payload)
}

function handleBillsCategoriesChanged(change: BillsCategoryChange) {
  billsSidebarRefreshTick.value += 1
  void billsPanel.handleCategoriesChanged(change)
}

// 周期类导航退出搜索（事件回调里调用：点当前已选月份这类"同值"动作也要退出）
function handleBillsSelectMonth(value: string) {
  billsPanel.exitSearch()
  billsPanel.selectedMonth.value = value
}

function handleBillsSelectYear(value: number) {
  billsPanel.exitSearch()
  billsPanel.selectedYear.value = value
}

function handleBillsSelectStatsMode(value: 'month' | 'year') {
  billsPanel.exitSearch()
  billsPanel.statsMode.value = value
}

function handleBillsActiveTab(value: 'detail' | 'stats') {
  if (value === 'stats') {
    billsPanel.exitSearch()
  }
  billsPanel.activeTab.value = value
}

function handleBillsDetailMonthFilter(value: 'all' | string) {
  billsPanel.exitSearch()
  billsPanel.detailMonthFilter.value = value
}
```

- `handleGlobalKeydown` 替换为：

```ts
function handleGlobalKeydown(event: KeyboardEvent) {
  if (rightPanel.value === 'bills') {
    const isFindShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'f'
    if (isFindShortcut) {
      event.preventDefault()
      billsPanelRef.value?.focusSearchInput()
    }
    return
  }

  if (rightPanel.value !== 'journal') {
    return
  }

  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    void handleShiftSelectedDate(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    void handleShiftSelectedDate(1)
  }
}
```

- [ ] **Step 5: `AppShellPage.vue` template**

BillsSidebar 绑定改为：

```html
          @update:selected-month="handleBillsSelectMonth"
          @update:selected-year="handleBillsSelectYear"
          @update:stats-mode="handleBillsSelectStatsMode"
          @category-changed="handleBillsCategoriesChanged"
```

BillsPanel：加 `ref="billsPanelRef"`，新增 props/emits：

```html
        ref="billsPanelRef"
        ...
        :search-input="billsPanel.searchInput.value"
        :search-keyword="billsPanel.searchKeyword.value"
        :search-records="billsPanel.searchWindow.value.records"
        :search-total="billsPanel.searchWindow.value.total"
        :search-income="billsPanel.searchWindow.value.income"
        :search-expense="billsPanel.searchWindow.value.expense"
        :is-search-loading="billsPanel.isSearchLoading.value"
        :is-search-loading-more="billsPanel.isSearchLoadingMore.value"
        :search-error-message="billsPanel.searchErrorMessage.value"
        @update:search-input="billsPanel.searchInput.value = $event"
        @search-submit="billsPanel.submitSearch"
        @search-clear="billsPanel.exitSearch"
        @search-load-more="billsPanel.loadMoreSearch"
        @update:active-tab="handleBillsActiveTab"
        @update:detail-month-filter="handleBillsDetailMonthFilter"
        @record-saved="handleBillsRecordSaved"
```

（`@update:category-filter` 与 `@load-more` 等其余绑定保持现状。）

- [ ] **Step 6: `useAppShell.ts` 增加"离开记账页"过渡 watcher**

在 `const billsPanel = useBillsPanel(state.workspacePath)` 之后：

```ts
  // 离开记账页（含通知点击、托盘菜单等所有导航路径）一律退出备注搜索
  watch(state.rightPanel, (value) => {
    if (value !== 'bills') {
      billsPanel.exitSearch()
    }
  })
```

- [ ] **Step 7: 类型检查与单测**

Run: `npm run typecheck`
Expected: 无错误

Run: `npm run test`
Expected: 全部 PASS

- [ ] **Step 8（可选）: 手工冒烟**

`npm run dev` 后：搜「鼠标」回车 → 结果与统计出现；点开记录 →「复制到今天」→ 新记录出现在顶部、列表不重载；Ctrl+F 聚焦；其他页面 Ctrl+F 无反应。

- [ ] **Step 9: 提交**

```bash
git add src/components/bills/components/BillsPanel/BillsPanel.vue src/components/bills/components/BillsPanel/BillsPanel.css src/app/pages/AppShellPage.vue src/app/composables/useAppShell.ts
git commit -m "feat(bills): 明细页新增全局备注搜索并接入 Ctrl+F"
```

---

## Task 7: 文档同步与全量验证

**Files:**
- Modify: `docs/system/bills.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 更新 `docs/system/bills.md`**

1. §二 IPC 表新增一行：

```md
| `searchBills` | `bills:search` | 备注全历史搜索（分页 + 全量统计，日边界对齐） | `BillsSearchResult` |
```

2. §三 service 表新增一行：

```md
| `searchBills` | `service.ts`（新增） | `note LIKE` 搜索：`iterate` 流式汇总 + `LIMIT/OFFSET` 分页 + 日边界对齐；空关键词抛错，limit 夹取 1–100 |
```

3. 新增小节 `### 5.5 备注搜索（useBillsPanel）`，内容包含：

```md
- 状态：`searchInput`（未提交输入）、`searchKeyword`（空=非搜索态）、`searchWindow`（records/total/income/expense，分）、`isSearchLoading`、`isSearchLoadingMore`、`searchErrorMessage`，全部异步响应带 `searchSequence` 序列号守卫
- 提交与退出：回车提交（`isComposing` 守卫）、空内容回车退出；Esc/✕/摘要条「清除」退出；切统计 tab、周期导航（月份/年份/月度-年度/年度月份筛选/回到本月）、离开记账页（`rightPanel` 过渡 watcher，覆盖通知/托盘导航）、切换工作区均退出；退出即清输入，浏览状态不动
- 分页：首批 30 条，「查看更多（剩余 N 笔）」按 `offset = 已加载条数` 追加；取数按日边界对齐（同一天记录不跨批切开，日期组小计始终完整）
- 就地更新：弹窗保存/删除/复制不重查数据库，`applyBillsMutation` 就地更新窗口并维护全量统计（统计恒定镜像匹配集；`total−1` 仅发生在删除或改到不再匹配）；净移除且仍有未加载时以 `limit=1` 补位
- 分类变更：重命名对已加载结果就地改名（与主进程 SQL 同规则）；增删改任何变更后静默刷新一次全量统计
- Ctrl+F：仅账单页生效；`handleGlobalKeydown` 的 bills 分支 `preventDefault` 后调用 `BillsPanel.focusSearchInput()`（非明细 tab / 弹窗打开时不聚焦）
```

4. §六 组件表：BillsPanel 行补「明细工具栏含全局搜索框与搜索态结果区」；BillsRecordModal 行补「`saved` 事件携带 `BillsSavedPayload`（create/duplicate/update）」。
5. §八 测试表新增行：`search.test.ts`（`billMatchesKeyword`/`splitNoteByKeyword`/`billSearchContribution`/`applyCategoryRenameToBill`/`applyBillsMutation`）。
6. §九 关键函数位置表新增：`billMatchesKeyword`/`splitNoteByKeyword`/`billSearchContribution`/`applyCategoryRenameToBill`/`applyBillsMutation`（`src/shared/bills-logic.ts`）、`searchBills`（`electron/main/bills/service.ts`）。

- [ ] **Step 2: 更新 `CHANGELOG.md`**

当前文件末尾只有 `## unreleased [1.9.0]`，补齐分组并新增条目：

```md
## unreleased [1.9.0]

### 新增

- 记账：新增备注全局搜索（回车搜索全部历史账单，分批加载，结果可直接编辑/复制/删除并就地更新，Ctrl+F 快速聚焦）
```

- [ ] **Step 3: 全量验证**

Run: `npm run test`
Expected: 全部 PASS

Run: `npm run typecheck`
Expected: 无错误

Run: `npm run build`
Expected: 构建与打包成功

- [ ] **Step 4: 手工验收（对照 spec §6.2）**

1. 搜「手撕鸡」回车 → 列表回到顶部、高亮结果、全量统计；Esc 回到原月份普通列表
2. 忘年份场景：命中记录分布在不同年份，日期标题带年份
3. Ctrl+F：账单页聚焦并全选；写日记页/设置页无反应；统计 tab 无反应；弹窗打开时无反应
4. 退出触发逐项：切统计、切页面（含从通知点击 / 托盘菜单离开后再返回）、点月份、点年份、「回到本月」、月度/年度切换、年度月份筛选、点当前已选月份、切工作区 → 均退出且浏览状态保留
5. 搜索态回车空内容退出；输入未提交文字随切换被清掉
6. 结果点开 →「复制到今天」→ 弹窗关、新记录出现在结果顶部、其余原位、滚动不动
7. 编辑到不再含关键词 → 该条消失、从后面补一条；删除 → 消失、补位、统计减
8. 「查看更多」：剩余数递减、按钮 loading 态、同日记录不跨批切开
9. 分类重命名 → 结果里同类记录同步改名；删除自定义 transfer 分类 → 结果样式回退「其他」，且摘要条统计与每日小计一致
10. 空结果文案；搜索失败（临时构造）可重试
11. 导出 Excel 不受搜索影响；深色主题 / 窗口缩放无样式异常

- [ ] **Step 5: 提交**

```bash
git add docs/system/bills.md CHANGELOG.md
git commit -m "docs(bills): 同步备注搜索文档与变更日志"
```

---

## 自检记录

- **规范覆盖**：交互规格 3.1/3.3（UI）→ Task 6；3.2（提交与退出）→ Task 4/6；3.4（分页/日对齐）→ Task 2/3/4；3.5（就地更新）→ Task 2/4；3.6（Ctrl+F）→ Task 6；3.7（联动）→ Task 4/5；类型与 IPC 4.2 → Task 2/3；service 4.3 → Task 3；纯逻辑 4.4 → Task 1/2；渲染层 4.5 → Task 4；组件接线 4.6 → Task 5/6；样式 4.7 → Task 6；正确性论证 5 → Task 2/4；测试计划 6 → Task 1/2/7；文档同步 7 → Task 7。
- **类型一致性**：`BillsSearchWindow`/`BillsSavedPayload`/`BillsSearchMutation`/`BillsCategoryChange`（Task 2 定义 → Task 3/4/5/6 使用）；`BillsSearchInput`/`BillsSearchResult`（Task 3 定义 → Task 3/4 使用）；`applyBillsMutation`（Task 2 定义 → Task 4 使用）；`BILLS_SEARCH_PAGE_SIZE`/`billMatchesKeyword`/`applyCategoryRenameToBill`（Task 1 定义 → Task 2/3/4 使用）；composable 导出名与 AppShell 绑定名逐一对齐（Task 4 ↔ Task 6）。
- **已知取舍**：编辑移动导致"移出窗口"时依赖补位/查看更多恢复显示（spec §3.7 可接受项）；日对齐可能使单批返回多于 30 条（spec §3.4）。
