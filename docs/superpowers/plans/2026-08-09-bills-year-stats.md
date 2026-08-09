# 记账「月度/年度」统计模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为记账功能增加「月度/年度」模式切换：侧栏选择月度或任意年份，年度模式下明细展示全年按天分组长列表（可按月份筛选），统计页新增每日折线图与近6年对比柱状图，并修复现有「近6个月支出对比」只显示当月数据的 bug。

**Architecture:** 侧栏复用共享组件 `YearPickerGrid`（新增「有数据年份/月份」高亮，由 2 个新 IPC 提供数据标记）；窗口数据（近6月/近6年对比图）由前端并行复用现有 `listBillsByMonth`/`listBillsByYear` 后聚合，不新增统计 IPC，遵循「统计在前端聚合」约定；`BillsCharts` 新增 ECharts LineChart 实例与 `windowTotals` prop。

**Tech Stack:** Vue 3 + TypeScript + ECharts 6（core 按需注册）+ better-sqlite3 + vitest。

设计文档：`docs/superpowers/specs/2026-08-09-bills-year-stats-design.md`

---

### Task 1: 共享纯逻辑函数（TDD）

**Files:**
- Modify: `src/shared/bills-logic.ts`
- Test: `tests/bills/window.test.ts`（新建）

新增 5 个纯函数：窗口期推导、支出总额、月份过滤、闰年与全年日期序列。

- [ ] **Step 1: 写失败测试**

创建 `tests/bills/window.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  buildDailyAxis,
  buildMonthWindow,
  buildYearWindow,
  expenseTotal,
  filterBillsByMonth,
  isLeapYear,
} from '../../src/shared/bills-logic'
import { BUILTIN_CATEGORIES, type Bill } from '../../src/types/bills'

const CATEGORIES = BUILTIN_CATEGORIES

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

describe('buildMonthWindow', () => {
  it('returns current month and previous months in ascending order', () => {
    expect(buildMonthWindow('2026-08', 6)).toEqual([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ])
  })

  it('crosses year boundary', () => {
    expect(buildMonthWindow('2026-01', 6)).toEqual([
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
    ])
  })

  it('handles count of one', () => {
    expect(buildMonthWindow('2026-08', 1)).toEqual(['2026-08'])
  })
})

describe('buildYearWindow', () => {
  it('returns current year and previous years in ascending order', () => {
    expect(buildYearWindow('2026', 6)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026'])
  })

  it('handles count of one', () => {
    expect(buildYearWindow('2026', 1)).toEqual(['2026'])
  })
})

describe('expenseTotal', () => {
  it('sums only expense records, excludes income and transfer', () => {
    const records = [
      makeBill({ amountCents: -2346, category: '餐饮' }),
      makeBill({ amountCents: 12000, category: '工资' }),
      makeBill({ amountCents: -100000, category: '理财' }),
    ]
    expect(expenseTotal(records, CATEGORIES)).toBe(2346)
  })

  it('returns 0 when no expense', () => {
    const records = [makeBill({ amountCents: 12000, category: '工资' })]
    expect(expenseTotal(records, CATEGORIES)).toBe(0)
  })
})

describe('filterBillsByMonth', () => {
  it('keeps only records of the given month', () => {
    const records = [
      makeBill({ date: '2026-08-01' }),
      makeBill({ date: '2026-08-20' }),
      makeBill({ date: '2026-01-05' }),
    ]
    const result = filterBillsByMonth(records, '08')
    expect(result.map((r) => r.date)).toEqual(['2026-08-01', '2026-08-20'])
  })

  it('returns empty array when no match', () => {
    expect(filterBillsByMonth([makeBill({ date: '2026-01-05' })], '08')).toEqual([])
  })
})

describe('isLeapYear', () => {
  it('detects leap years', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
  })
})

describe('buildDailyAxis', () => {
  it('returns 365 dates for a common year', () => {
    const dates = buildDailyAxis(2026)
    expect(dates).toHaveLength(365)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates[364]).toBe('2026-12-31')
  })

  it('returns 366 dates for a leap year', () => {
    expect(buildDailyAxis(2024)).toHaveLength(366)
    expect(buildDailyAxis(2024).at(59)).toBe('2024-02-29')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/bills/window.test.ts`
Expected: FAIL（`buildMonthWindow` 等函数不存在，导入报错）

- [ ] **Step 3: 实现纯函数**

在 `src/shared/bills-logic.ts` 末尾追加：

```ts
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

export function filterBillsByMonth(records: Bill[], month: string): Bill[] {
  return records.filter((record) => record.date.slice(5, 7) === month)
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/bills/window.test.ts`
Expected: PASS（7 个 describe 全部通过）

- [ ] **Step 5: 提交**

```bash
git add src/shared/bills-logic.ts tests/bills/window.test.ts
git commit -m "feat(bills): add window/daily axis/expense total pure functions"
```

---

### Task 2: 新增 IPC 通道（有数据年份/月份）

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/types/bills.ts`
- Modify: `src/types/api.ts`
- Modify: `electron/main/bills/service.ts`
- Modify: `electron/main/ipc/bills.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 通道常量**

`src/shared/ipc-channels.ts` 的 `// bills` 段（第 62-72 行）末尾追加两行：

```ts
  listBillsYears: 'bills:list-years',
  listBillsMonths: 'bills:list-months',
```

- [ ] **Step 2: 输入类型**

`src/types/bills.ts` 在 `BillsListYearInput`（第 26-29 行）之后追加：

```ts
export interface BillsListMonthsInput {
  workspacePath: string
  year: string
}
```

`src/types/api.ts` 顶部导入区确认已含 `BillsListMonthsInput`（若没有，在 `BillsListMonthInput` 导入旁追加），并在 `listBillsByYear`（第 146 行）之后追加两个方法签名：

```ts
  listBillsYears: (input: BillsCategoryQuery) => Promise<string[]>
  listBillsMonths: (input: BillsListMonthsInput) => Promise<string[]>
```

- [ ] **Step 3: 主进程 service**

`electron/main/bills/service.ts` 在 `listBillsByYear`（第 56-69 行）之后追加：

```ts
export async function listBillsYears(workspacePath: string): Promise<string[]> {
  const db = getBillsDatabase(workspacePath)
  if (!db) {
    return []
  }
  const rows = db
    .prepare('SELECT DISTINCT substr(date, 1, 4) AS period FROM bills ORDER BY period')
    .all() as Array<{ period: string }>
  return rows.map((row) => row.period)
}

export async function listBillsMonthsOfYear(input: BillsListMonthsInput): Promise<string[]> {
  if (!/^\d{4}$/.test(input.year)) {
    throw new Error('年份格式无效，必须为 YYYY。')
  }

  const db = getBillsDatabase(input.workspacePath)
  if (!db) {
    return []
  }
  const rows = db
    .prepare('SELECT DISTINCT substr(date, 1, 7) AS period FROM bills WHERE date LIKE ? ORDER BY period')
    .all(`${input.year}-%`) as Array<{ period: string }>
  return rows.map((row) => row.period)
}
```

同时更新该文件顶部的 `import type`（第 1-12 行），加入 `BillsListMonthsInput`。

- [ ] **Step 4: IPC handler**

`electron/main/ipc/bills.ts`：
- import 块加入 `BillsListMonthsInput` 与 `listBillsMonthsOfYear, listBillsYears`
- `registerBillsIpcHandlers` 中 `listBillsByYear` handler 之后追加：

```ts
  ipcMain.handle(IPC_CHANNELS.listBillsYears, (_event, input: BillsCategoryQuery) =>
    listBillsYears(input.workspacePath),
  )
  ipcMain.handle(IPC_CHANNELS.listBillsMonths, (_event, input: BillsListMonthsInput) =>
    listBillsMonthsOfYear(input),
  )
```

- [ ] **Step 5: preload**

`electron/preload.ts` 第 138 行（`listBillsByYear`）之后追加：

```ts
  listBillsYears: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsYears, input),
  listBillsMonths: (input) => ipcRenderer.invoke(IPC_CHANNELS.listBillsMonths, input),
```

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 无新错误

- [ ] **Step 7: 提交**

```bash
git add src/shared/ipc-channels.ts src/types/bills.ts src/types/api.ts electron/main/bills/service.ts electron/main/ipc/bills.ts electron/preload.ts
git commit -m "feat(bills): add list-years/list-months IPC for picker data markers"
```

---

### Task 3: useBillsPanel 状态扩展

**Files:**
- Modify: `src/components/bills/composables/useBillsPanel.ts`

- [ ] **Step 1: 替换 `statsScope` 为 `statsMode`，新增年度/窗口/明细状态**

在 `useBillsPanel` 函数体内，将第 23 行：

```ts
  const statsScope = ref<'month' | 'year'>('month')
```

替换为：

```ts
  const statsMode = ref<'month' | 'year'>('month')
  const selectedYear = ref(dayjs().year())
  const detailMonthFilter = ref<'all' | string>('all')
  const windowTotals = ref<BillsWindowTotal[]>([])
  let windowLoadSequence = 0
```

- [ ] **Step 2: 更新 computed 与 watch**

将第 36-58 行的 `selectedYear` computed、`detailRecords`、`statsRecords`、watch 段整体替换为：

```ts
  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const selectedYearText = computed(() => String(selectedYear.value))
  const statsYear = computed(() =>
    statsMode.value === 'year' ? selectedYearText.value : selectedMonth.value.slice(0, 4),
  )

  const detailRecords = computed(() => {
    if (statsMode.value === 'year') {
      if (detailMonthFilter.value === 'all') {
        return yearRecords.value
      }
      return filterBillsByMonth(yearRecords.value, detailMonthFilter.value)
    }
    return monthRecords.value
  })

  const statsRecords = computed(() =>
    statsMode.value === 'month' ? monthRecords.value : yearRecords.value,
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
    void reloadWindowTotals()
  })

  watch(statsYear, () => {
    void reloadYearRecords()
    void reloadWindowTotals()
  })

  watch(statsMode, () => {
    void reloadWindowTotals()
  })
```

注意原第 37 行 `const selectedYear = computed(() => selectedMonth.value.slice(0, 4))` 与新增 ref 同名，直接删除旧 computed。

- [ ] **Step 3: 新增 `reloadWindowTotals` 加载函数**

在 `reloadYearRecords`（原第 102-117 行）之后追加：

```ts
  async function reloadWindowTotals() {
    if (!workspacePath.value) {
      windowTotals.value = []
      return
    }
    const current = ++windowLoadSequence
    try {
      statusMessage.value = ''
      if (statsMode.value === 'month') {
        const periods = buildMonthWindow(selectedMonth.value, 6)
        const results = await Promise.all(
          periods.map((period) =>
            window.dairy.listBillsByMonth({ workspacePath: workspacePath.value!, month: period }),
          ),
        )
        if (current === windowLoadSequence) {
          windowTotals.value = periods.map((period, index) => ({
            period,
            total: expenseTotal(results[index], categories.value),
          }))
        }
      } else {
        const periods = buildYearWindow(selectedYearText.value, 6)
        const results = await Promise.all(
          periods.map((year) =>
            window.dairy.listBillsByYear({ workspacePath: workspacePath.value!, year }),
          ),
        )
        if (current === windowLoadSequence) {
          windowTotals.value = periods.map((period, index) => ({
            period,
            total: expenseTotal(results[index], categories.value),
          }))
        }
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }
```

- [ ] **Step 4: 在既有加载/变更点挂上窗口刷新**

- `handleWorkspaceChange`（第 68 行）：`await Promise.all([loadCategories(), reloadMonthRecords(), reloadYearRecords()])` 改为 `await Promise.all([loadCategories(), reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])`
- `handleRecordSaved`（第 133 行）：`await Promise.all([reloadMonthRecords(), reloadYearRecords()])` 改为 `await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])`
- `handleDeleteRecord`（第 143 行）：同上替换
- `handleDeleteFromModal`（第 159 行）：同上替换
- `handleCategoriesChanged`（第 167 行）：同上替换

- [ ] **Step 5: 更新 import 与返回**

文件顶部 import（第 5 行）改为：

```ts
import {
  aggregateRecords,
  buildMonthWindow,
  buildYearWindow,
  expenseTotal,
  filterBillsByMonth,
  formatCents,
  formatPlainCents,
  resolveCategory,
} from '../../../shared/bills-logic'
```

`src/types/bills.ts` 顶部追加窗口总额类型：

```ts
export interface BillsWindowTotal {
  period: string
  total: number
}
```

`useBillsPanel` 返回值（第 188-214 行）调整：

- 删除 `statsScope`、`statsSummary` 保留但检查引用；最终返回对象替换为：

```ts
  return {
    activeTab,
    categories,
    closeModal,
    detailMonthFilter,
    detailRecords,
    detailSummary,
    handleCategoriesChanged,
    handleDeleteFromModal,
    handleDeleteRecord,
    handleExportExcel,
    handleRecordSaved,
    hasWorkspace,
    isLoading,
    isExporting,
    modalState,
    monthRecords,
    openCreateModal,
    openEditModal,
    selectedMonth,
    selectedYear,
    sidebarStatusMessage,
    statsMode,
    statsRecords,
    statsSummary,
    statusMessage,
    windowTotals,
    yearRecords,
  }
```

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 报错仅来自尚未改动的调用侧（`BillsPanel.vue`/`AppShellPage.vue` 中 `statsScope`），将在 Task 6/7 消除；`useBillsPanel.ts` 自身无错误。

- [ ] **Step 7: 提交**

```bash
git add src/types/bills.ts src/components/bills/composables/useBillsPanel.ts
git commit -m "feat(bills): add statsMode/selectedYear/windowTotals state to useBillsPanel"
```

---

### Task 4: 侧栏月度/年度切换与数据高亮

**Files:**
- Modify: `src/components/bills/composables/useBillsSidebar.ts`
- Modify: `src/components/bills/components/BillsSidebar/BillsSidebar.vue`
- Modify: `src/components/bills/components/BillsSidebar/BillsSidebar.css`

- [ ] **Step 1: 扩展 composable props/emits/状态**

`useBillsSidebar.ts`：

props 接口（第 7-14 行）替换为：

```ts
export interface BillsSidebarProps {
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  selectedYear: number
  statsMode: 'month' | 'year'
  categories: BillCategory[]
  isExporting: boolean
  statusMessage: string
}
```

emits 类型（第 16-20 行）替换为：

```ts
export type BillsSidebarEmits = {
  'update:selectedMonth': [value: string]
  'update:selectedYear': [value: number]
  'update:statsMode': [value: 'month' | 'year']
  categoryChanged: []
  export: []
}
```

`useBillsSidebar` 函数体（第 33 行之后）追加：

```ts
  const availableYears = ref<string[]>([])
  const availableMonths = ref<string[]>([])
  const hasDataYears = computed(() => new Set(availableYears.value))
  const availableMonthsSet = computed(() => new Set(availableMonths.value))
  let yearsLoadSequence = 0
  let monthsLoadSequence = 0

  watch(
    () => props.workspacePath,
    () => {
      void loadAvailableYears()
      void loadAvailableMonths()
    },
    { immediate: true },
  )

  watch(monthPickerYear, () => {
    void loadAvailableMonths()
  })

  async function loadAvailableYears() {
    if (!props.workspacePath) {
      availableYears.value = []
      return
    }
    const current = ++yearsLoadSequence
    try {
      const years = await window.dairy.listBillsYears({ workspacePath: props.workspacePath })
      if (current === yearsLoadSequence) {
        availableYears.value = years
      }
    } catch {
      // 高亮是增强能力，查询失败不影响月份/年份选择
    }
  }

  async function loadAvailableMonths() {
    if (!props.workspacePath) {
      availableMonths.value = []
      return
    }
    const current = ++monthsLoadSequence
    try {
      const months = await window.dairy.listBillsMonths({
        workspacePath: props.workspacePath,
        year: String(monthPickerYear.value),
      })
      if (current === monthsLoadSequence) {
        availableMonths.value = months
      }
    } catch {
      // 高亮是增强能力，查询失败不影响月份/年份选择
    }
  }
```

`monthCells`（第 49-59 行）中每个 cell 追加 `hasData` 字段：

```ts
      return {
        key,
        label,
        isSelected: key === props.selectedMonth,
        isCurrent: key === dayjs().format('YYYY-MM'),
        hasData: availableMonthsSet.value.has(key),
      }
```

返回值（第 164-183 行）追加 `hasDataYears`，其余保持：

```ts
    goToCurrentMonth,
    handleCreateCategory,
    handleCreateKeydown,
    handleDeleteCategory,
    handleRenamePrompt,
    hasDataYears,
    isCategoryPanelExpanded,
    isMutatingCategory,
    monthCells,
    monthPickerTitle,
    newCategoryName,
    selectMonth,
    shiftMonthPickerYear,
    switchCategoryTab,
    typeTabs,
```

- [ ] **Step 2: 侧栏模板改造**

`BillsSidebar.vue`：
- script 顶部导入 `YearPickerGrid`：

```ts
import YearPickerGrid from '../../../shared/YearPickerGrid.vue'
```

- 解构返回值追加 `hasDataYears`：

```ts
  goToCurrentMonth,
  handleCreateCategory,
  handleCreateKeydown,
  handleDeleteCategory,
  handleRenamePrompt,
  hasDataYears,
  isCategoryPanelExpanded,
  isMutatingCategory,
  monthCells,
  monthPickerTitle,
  newCategoryName,
  selectMonth,
  shiftMonthPickerYear,
  switchCategoryTab,
  typeTabs,
} = useBillsSidebar(props, emit)
```

- 「记账月份」卡片（第 37-69 行）整体替换为：

```html
    <section class="panel-card">
      <h3 class="panel-title">记账月份</h3>

      <div class="preset-tabs" role="tablist">
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': statsMode === 'month' }"
          type="button"
          role="tab"
          @click="emit('update:statsMode', 'month')"
        >
          月度
        </button>
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': statsMode === 'year' }"
          type="button"
          role="tab"
          @click="emit('update:statsMode', 'year')"
        >
          年度
        </button>
      </div>

      <template v-if="statsMode === 'month'">
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
                'picker-cell--has-data': item.hasData,
              }"
              type="button"
              @click="selectMonth(item.key)"
            >
              {{ item.label }}
            </button>
          </div>

          <button class="today-button" type="button" @click="goToCurrentMonth">回到本月</button>
        </section>
      </template>

      <YearPickerGrid
        v-else
        :selected-year="selectedYear"
        :has-data-years="hasDataYears"
        @update:selected-year="emit('update:selectedYear', $event)"
      />
    </section>
```

- [ ] **Step 3: 侧栏 CSS**

`BillsSidebar.css` 在 `.panel-title`（第 47 行）之后追加：

```css
.preset-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.preset-tab {
  min-height: 2.3rem;
  padding: 0 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-interactive);
  color: var(--color-text-main);
  font-size: 0.9rem;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.preset-tab--active {
  background: var(--color-accent-soft);
  border-color: var(--color-border-strong);
  font-weight: 600;
}

.preset-tab:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}
```

在 `.picker-cell--current`（第 128 行）之前追加：

```css
.picker-cell--has-data {
  background: var(--color-accent-muted);
  border-color: var(--color-border-report-picker);
}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 报错仅剩调用侧（AppShellPage 未传新 props），Task 7 消除。

- [ ] **Step 5: 提交**

```bash
git add src/components/bills/composables/useBillsSidebar.ts src/components/bills/components/BillsSidebar/BillsSidebar.vue src/components/bills/components/BillsSidebar/BillsSidebar.css
git commit -m "feat(bills): add month/year mode tabs with data markers to sidebar"
```

---

### Task 5: BillsCharts 统计图表（折线图 + 近6年对比 + 窗口修复）

**Files:**
- Modify: `src/components/bills/components/BillsCharts/BillsCharts.vue`

- [ ] **Step 1: 重写组件（核心逻辑）**

将 `BillsCharts.vue` 的 `<script setup>` 部分（第 1-229 行）整体替换为：

```ts
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Bill, BillCategory, BillsWindowTotal } from '../../../../types/bills'
import {
  aggregateRecords,
  buildDailyAxis,
  formatPlainCents,
  resolveCategory,
} from '../../../../shared/bills-logic'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  records: Bill[]
  categories: BillCategory[]
  scope: 'month' | 'year'
  selectedMonth: string
  scopeYear: string
  windowTotals: BillsWindowTotal[]
}>()

const ringEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
const lineEl = ref<HTMLElement | null>(null)
const windowEl = ref<HTMLElement | null>(null)
let ringChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let lineChart: echarts.ECharts | null = null
let windowChart: echarts.ECharts | null = null
let themeObserver: MutationObserver | null = null
let resizeHandler: (() => void) | null = null

const CHART_TEXT = '#6B766D'
const CHART_SPLIT = '#EDF1EC'

const categoryExpense = computed(() => {
  const map = new Map<string, number>()
  for (const record of props.records) {
    const resolved = resolveCategory(props.categories, record.amountCents, record.category)
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
  for (const record of props.records) {
    const resolved = resolveCategory(props.categories, record.amountCents, record.category)
    if (resolved.type !== 'expense') continue
    map.set(record.date, (map.get(record.date) ?? 0) + -record.amountCents)
  }
  return map
})

const periodText = computed(() => {
  if (props.scope === 'year') {
    return `${props.scopeYear}年`
  }
  const [year, month] = props.selectedMonth.split('-')
  return `${year}年${Number(month)}月`
})

const dailyAxis = computed(() => buildDailyAxis(Number(props.scopeYear)))

const dailyValues = computed(() =>
  dailyAxis.value.map((date) =>
    Math.round(((dailyExpense.value.get(date) ?? 0) / 100) * 100) / 100,
  ),
)

function colorForCategory(name: string): string {
  const category = props.categories.find((c) => c.name === name)
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

function ensureCharts() {
  if (!ringChart && ringEl.value) {
    ringChart = echarts.init(ringEl.value)
  }
  if (!barChart && barEl.value) {
    barChart = echarts.init(barEl.value)
  }
  if (!lineChart && lineEl.value) {
    lineChart = echarts.init(lineEl.value)
  }
  if (!windowChart && windowEl.value) {
    windowChart = echarts.init(windowEl.value)
  }
}

function renderCharts() {
  ensureCharts()
  if (!ringChart || !barChart) return

  const total = props.records
    .filter((r) => resolveCategory(props.categories, r.amountCents, r.category).type === 'expense')
    .reduce((acc, r) => acc + -r.amountCents, 0)

  if (total > 0) {
    ringChart.setOption({
      tooltip: {
        trigger: 'item',
        textStyle: { fontSize: 13 },
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}：${p.value.toFixed(2)}（${p.percent}%）`,
      },
      legend: { bottom: 0, icon: 'circle', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 13, ...textStyle() } },
      series: [{
        type: 'pie',
        radius: ['50%', '78%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: readCssColor('--color-surface-elevated', '#FFFFFF'), borderWidth: 2, borderRadius: 4 },
        label: { show: true, formatter: '{b} {d}%', fontSize: 12, color: readCssColor('--color-text-main', '#37433A') },
        labelLine: { length: 10, length2: 8 },
        emphasis: { scaleSize: 4, label: { show: true, formatter: '{b} {d}%', fontSize: 12 } },
        data: categoryExpense.value.map((d) => ({ name: d.name, value: Math.round((d.value / 100) * 100) / 100, itemStyle: { color: colorForCategory(d.name) } })),
      }],
    })
  } else {
    ringChart.setOption({ title: { text: '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } } })
  }

  if (props.scope === 'month') {
    const dayCount = new Date(Number(props.selectedMonth.slice(0, 4)), Number(props.selectedMonth.slice(5, 7)), 0).getDate()
    const values: number[] = []
    for (let d = 1; d <= dayCount; d++) {
      const key = `${props.selectedMonth}-${String(d).padStart(2, '0')}`
      values.push(Math.round(((dailyExpense.value.get(key) ?? 0) / 100) * 100) / 100)
    }
    const hasData = values.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: values.map((_, i) => `${i + 1}日`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    renderWindowChart(
      props.windowTotals.map(({ period }) => {
        const [y, m] = period.split('-')
        return y === props.scopeYear ? `${Number(m)}月` : `${y}年${Number(m)}月`
      }),
      props.windowTotals.map(({ total }) => Math.round((total / 100) * 100) / 100),
    )
  } else {
    const monthValues = Array.from({ length: 12 }, (_, i) => {
      const prefix = `${props.scopeYear}-${String(i + 1).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const hasData = monthValues.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: monthValues.map((_, i) => `${i + 1}月`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: monthValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    renderDailyLine()

    renderWindowChart(
      props.windowTotals.map(({ period }) => `${Number(period)}年`),
      props.windowTotals.map(({ total }) => Math.round((total / 100) * 100) / 100),
    )
  }
}

function renderDailyLine() {
  if (!lineChart) return
  const hasData = dailyValues.value.some((v) => v > 0)
  const lineColor = readCssColor('--color-chart-positive', '#5A9F61')
  lineChart.setOption({
    title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      textStyle: { fontSize: 13 },
      formatter: (params: Array<{ axisValue: string; value: number }>) => `${params[0].axisValue}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}`,
    },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: dailyAxis.value,
      boundaryGap: false,
      axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } },
      axisTick: { show: false },
      axisLabel: {
        interval: (index: number, value: string) =>
          index === 0 || index === dailyAxis.value.length - 1 || value.endsWith('-01'),
        formatter: (value: string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`,
        ...textStyle(),
      },
    },
    yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
    series: [{
      type: 'line',
      data: dailyValues.value,
      smooth: false,
      symbol: 'none',
      lineStyle: { width: 2, color: lineColor },
      areaStyle: { opacity: 0.12, color: lineColor },
    }],
  })
}

function renderWindowChart(labels: string[], values: number[]) {
  if (!windowChart) return
  const hasData = values.some((v) => v > 0)
  windowChart.setOption({
    title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
    yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
    series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
  })
}

watch(
  () => [props.records, props.categories, props.scope, props.selectedMonth, props.scopeYear, props.windowTotals],
  async () => {
    if (props.scope === 'year') {
      windowChart?.dispose()
      windowChart = null
    } else {
      lineChart?.dispose()
      lineChart = null
    }
    await nextTick()
    ensureCharts()
    renderCharts()
  },
)

onMounted(() => {
  ensureCharts()

  resizeHandler = () => {
    ringChart?.resize()
    barChart?.resize()
    lineChart?.resize()
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
  lineChart?.dispose()
  windowChart?.dispose()
  ringChart = null
  barChart = null
  lineChart = null
  windowChart = null
})
</script>
```

- [ ] **Step 2: 更新模板**

模板部分（第 231-261 行）替换为：

```html
<template>
  <div class="charts-stack">
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-label">总支出</div>
        <div class="stat-value stat-expense">{{ formatPlainCents(aggregateRecords(props.records, props.categories).expense) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总收入</div>
        <div class="stat-value stat-income">{{ formatPlainCents(aggregateRecords(props.records, props.categories).income) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">结余</div>
        <div class="stat-value stat-net">{{ formatPlainCents(aggregateRecords(props.records, props.categories).net) }}</div>
      </div>
    </div>

    <div class="chart-box">
      <h3 class="chart-title">{{ periodText }}分类支出占比</h3>
      <div ref="ringEl" class="chart chart--ring"></div>
    </div>
    <div class="chart-box">
      <h3 class="chart-title">{{ periodText }}{{ scope === 'month' ? '每日支出' : '月度支出' }}</h3>
      <div ref="barEl" class="chart"></div>
    </div>
    <div v-if="scope === 'year'" class="chart-box">
      <h3 class="chart-title">{{ periodText }}每日支出</h3>
      <div ref="lineEl" class="chart chart--line"></div>
    </div>
    <div class="chart-box">
      <h3 class="chart-title">{{ scope === 'month' ? '近6个月支出对比' : '近6年支出对比' }}</h3>
      <div ref="windowEl" class="chart"></div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: CSS 追加折线图高度**

`BillsCharts.css` 在 `.chart--ring`（第 65-67 行）之后追加：

```css
.chart--line {
  height: 320px;
}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 报错仅剩 BillsPanel/AppShellPage 未传新 props，Task 6/7 消除。

- [ ] **Step 5: 提交**

```bash
git add src/components/bills/components/BillsCharts/BillsCharts.vue src/components/bills/components/BillsCharts/BillsCharts.css
git commit -m "feat(bills): add daily line chart and 6-year window chart, fix month window data"
```

---

### Task 6: BillsPanel 明细/统计适配

**Files:**
- Modify: `src/components/bills/components/BillsPanel/BillsPanel.vue`
- Modify: `src/components/bills/components/BillsPanel/BillsPanel.css`

- [ ] **Step 1: props/emits 调整**

`BillsPanel.vue` script 部分（第 18-40 行）替换为：

```ts
const props = defineProps<{
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  records: Bill[]
  detailRecords: Bill[]
  categories: BillCategory[]
  activeTab: 'detail' | 'stats'
  statsMode: 'month' | 'year'
  selectedYear: number
  detailMonthFilter: 'all' | string
  windowTotals: BillsWindowTotal[]
  isLoading: boolean
  statusMessage: string
  modalState: BillsModalState
}>()

const emit = defineEmits<{
  'update:activeTab': [value: 'detail' | 'stats']
  'update:detailMonthFilter': [value: 'all' | string]
  openCreate: []
  openEdit: [bill: Bill]
  closeModal: []
  'record-saved': []
  deleted: []
}>()
```

import 行（第 4-16 行）调整为：

```ts
import type { Bill, BillCategory, BillsWindowTotal } from '../../../../types/bills'
import type { BillsModalState } from '../../composables/useBillsPanel'
import {
  aggregateRecords,
  formatCents,
  formatPlainCents,
  groupBillsByDay,
  resolveCategory,
} from '../../composables/useBillsPanel'
```

- [ ] **Step 2: computed 调整**

将第 46-56 行替换为：

```ts
const filteredRecords = computed(() =>
  categoryFilter.value
    ? props.detailRecords.filter((r) => r.category === categoryFilter.value)
    : props.detailRecords,
)

const detailGroups = computed(() => groupBillsByDay(filteredRecords.value))
const detailSummary = computed(() => aggregateRecords(filteredRecords.value, props.categories))

const periodText = computed(() =>
  props.statsMode === 'year'
    ? `${props.selectedYear}年`
    : `${Number(props.selectedMonth.slice(0, 4))}年${Number(props.selectedMonth.slice(5, 7))}月`,
)
```

删除原 `yearText`/`monthText` computed（不再使用）。

- [ ] **Step 3: 明细模板适配**

第 125-140 行 summary-bar 与空态替换为：

```html
        <div class="summary-bar">
          <span>
            {{ periodText }} · 共
            <strong>{{ detailSummary.count }}</strong>
            笔 · 支出 <span class="summary-expense">{{ formatPlainCents(detailSummary.expense) }}</span> · 收入
            <span class="summary-income">{{ formatPlainCents(detailSummary.income) }}</span>
          </span>
          <div class="summary-filters">
            <select
              v-if="statsMode === 'year'"
              class="summary-filter-select"
              :value="detailMonthFilter"
              @change="emit('update:detailMonthFilter', ($event.target as HTMLSelectElement).value)"
            >
              <option value="all">全部月份</option>
              <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }}月</option>
            </select>
            <BillsCategorySelect
              class="summary-filter"
              :categories="categories"
              v-model="categoryFilter"
              placeholder="全部分类"
              clearable
            />
          </div>
        </div>

        <div v-if="detailGroups.length === 0" class="placeholder-box">
          {{ categoryFilter
            ? '该分类下暂无账单记录'
            : statsMode === 'year'
              ? (detailMonthFilter === 'all' ? '该年暂无账单记录' : '该月份暂无账单记录')
              : '本月暂无账单记录' }}
        </div>
```

- [ ] **Step 4: 统计模板适配**

第 181-206 行替换为：

```html
      <div v-else class="stats-view">
        <BillsCharts
          :records="records"
          :categories="categories"
          :scope="statsMode"
          :selected-month="selectedMonth"
          :scope-year="statsMode === 'year' ? String(selectedYear) : selectedMonth.slice(0, 4)"
          :window-totals="windowTotals"
        />
      </div>
```

- [ ] **Step 5: CSS 调整**

`BillsPanel.css`：
- 删除 `.stats-scope-tabs`、`.stats-scope-tab`、`.stats-scope-tab--active` 三段规则（第 331-353 行）
- 在 `.summary-filter` 规则（第 106-114 行）之后追加：

```css
.summary-filters {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: none;
}

.summary-filter-select {
  min-height: 2.2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-elevated);
  color: var(--color-text-main);
  font-size: 0.9rem;
  outline: none;
}

.summary-filter-select:focus {
  border-color: var(--color-border-strong);
}
```

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 报错仅剩 AppShellPage 调用侧，Task 7 消除。

- [ ] **Step 7: 提交**

```bash
git add src/components/bills/components/BillsPanel/BillsPanel.vue src/components/bills/components/BillsPanel/BillsPanel.css
git commit -m "feat(bills): year-mode detail list with month filter, drop stats scope tabs"
```

---

### Task 7: AppShellPage 绑定联动

**Files:**
- Modify: `src/app/pages/AppShellPage.vue`

- [ ] **Step 1: BillsSidebar 绑定**

第 226-237 行替换为：

```html
        <BillsSidebar
          v-else-if="rightPanel === 'bills'"
          :has-workspace="billsPanel.hasWorkspace.value"
          :workspace-path="workspacePath"
          :selected-month="billsPanel.selectedMonth.value"
          :selected-year="billsPanel.selectedYear.value"
          :stats-mode="billsPanel.statsMode.value"
          :categories="billsPanel.categories.value"
          :is-exporting="billsPanel.isExporting.value"
          :status-message="billsPanel.sidebarStatusMessage.value"
          @update:selected-month="billsPanel.selectedMonth.value = $event"
          @update:selected-year="billsPanel.selectedYear.value = $event"
          @update:stats-mode="billsPanel.statsMode.value = $event"
          @category-changed="billsPanel.handleCategoriesChanged"
          @export="billsPanel.handleExportExcel"
        />
```

- [ ] **Step 2: BillsPanel 绑定**

第 379-399 行替换为：

```html
      <BillsPanel
        v-else-if="rightPanel === 'bills'"
        :has-workspace="billsPanel.hasWorkspace.value"
        :workspace-path="workspacePath"
        :selected-month="billsPanel.selectedMonth.value"
        :records="billsPanel.statsRecords.value"
        :detail-records="billsPanel.detailRecords.value"
        :categories="billsPanel.categories.value"
        :active-tab="billsPanel.activeTab.value"
        :stats-mode="billsPanel.statsMode.value"
        :selected-year="billsPanel.selectedYear.value"
        :detail-month-filter="billsPanel.detailMonthFilter.value"
        :window-totals="billsPanel.windowTotals.value"
        :is-loading="billsPanel.isLoading.value"
        :status-message="billsPanel.statusMessage.value"
        :modal-state="billsPanel.modalState.value"
        @update:active-tab="billsPanel.activeTab.value = $event"
        @update:detail-month-filter="billsPanel.detailMonthFilter.value = $event"
        @open-create="billsPanel.openCreateModal"
        @open-edit="billsPanel.openEditModal"
        @close-modal="billsPanel.closeModal"
        @record-saved="billsPanel.handleRecordSaved"
        @deleted="billsPanel.handleDeleteFromModal"
      />
```

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/app/pages/AppShellPage.vue
git commit -m "feat(bills): wire month/year mode through app shell"
```

---

### Task 8: 全量验证

**Files:** 无新增改动（验证阶段）

- [ ] **Step 1: 运行全部测试**

Run: `npm test`
Expected: 全部通过（含既有 bills 测试与新增 window 测试）

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 构建成功（vue-tsc + vite build + electron-builder）

- [ ] **Step 4: 手工冒烟清单**

1. `npm run dev` 启动，进入记账页
2. 月度模式：明细/统计与改造前一致；「近6个月支出对比」前 5 个月显示真实数据（不再是 0）
3. 侧栏切「年度」：出现年份网格；选有数据的年份后：
   - 明细显示全年按天分组倒序列表，顶部月份筛选「全部/1~12月」可切换
   - 统计显示：统计卡（全年）、环形图（全年）、月度柱状图（12 月）、每日折线图（365 天，每月 1 号有刻度）、近6年支出对比（6 根柱子）
4. 切回「月度」：恢复原月份网格与选中月份，状态不串
5. 月份网格：有数据月份浅色高亮；年份网格：有数据年份高亮；「回到本年/回到本月」可用
6. 空数据年份：统计各图显示「暂无支出数据」
7. 深色/浅色主题切换：图表颜色跟随
8. 记账增删改一条记录后：统计与窗口对比图刷新

---

## 自审记录（写计划时自查）

- **Spec 覆盖**：侧栏 tab（Task 4）、年度明细长列表+月份筛选（Task 6）、月度保持现状（Task 5/6 仅数据修正）、年度 5 块图表（Task 5）、近6月 bug 修复（Task 5 windowTotals）、数据高亮 IPC（Task 2）、测试（Task 1/8）——全部覆盖
- **类型一致性**：`statsMode`、`selectedYear`、`detailMonthFilter`、`windowTotals`（`BillsWindowTotal[]`）、`scopeYear` 在 Task 3/5/6/7 中签名一致；IPC 通道名 `listBillsYears`/`listBillsMonths` 在 Task 2 全链路一致；纯函数 `buildMonthWindow`/`buildYearWindow`/`expenseTotal`/`filterBillsByMonth`/`isLeapYear`/`buildDailyAxis` 在 Task 1/3/5 引用一致
- **已知取舍**：`watch` 中 scope 切换时 dispose 对应图表实例（模板 v-if 会移除 DOM）；`hasDataYears`/`availableMonths` 加载失败静默（高亮为增强能力）
