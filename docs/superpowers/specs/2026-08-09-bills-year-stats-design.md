# 记账「月度/年度」统计模式设计

日期：2026-08-09
状态：已与用户确认

## 1. 背景与目标

当前记账统计只有「本月/全年」两个按钮，「全年」实际是选中月份所在年（年份只能靠侧栏月份选择器间接切换）。目标：参考总结报告页面，在侧栏提供「月度 / 年度」模式切换：

- **月度模式**：行为与现状完全一致（明细按天、统计图表现状），并修复「近6个月支出对比」bug（现仅当月数据，前 5 个月恒为 0）
- **年度模式**：选择任意年份，明细展示全年按天分组倒序长列表（顶部可按月份再筛），统计按整年聚合，图表包括分类环形图、每月柱状对比、每日折线图、近 6 年柱状对比

口径约定：所有统计图表只统计支出（与现状一致）；transfer 不计入收支。

## 2. 设计总览

```
BillsSidebar（侧栏）
  ├─ 记账月份卡片：月度 / 年度 两个 tab
  │    ├─ 月度：12 月网格（有数据月份高亮）
  │    └─ 年度：YearPickerGrid 年份网格（有数据年份高亮，复用共享组件）
  ├─ 分类管理（不变）
  └─ 导出 Excel（不变）

BillsPanel（右侧主区）
  ├─ 明细 tab：月度=按月展示（现状）；年度=全年按天分组倒序长列表 + 月份筛选
  └─ 统计 tab：移除「本月/全年」按钮，范围由侧栏决定
       ├─ 月度：统计卡 + 分类环形图 + 每日柱状图 + 近6月对比柱状图（修复）
       └─ 年度：统计卡 + 分类环形图 + 月度柱状图 + 每日折线图 + 近6年对比柱状图
```

## 3. 侧栏（BillsSidebar）

- 「记账月份」卡片顶部新增两个 tab：`月度 / 年度`，样式参考 ReportsSidebar 的 preset-tabs
- 月度模式：现有月份网格，新增 `picker-cell--has-data` 高亮（当月有账单记录）
- 年度模式：渲染共享组件 `YearPickerGrid`（props: selectedYear + hasDataYears；自带「回到本年」）
- 两个模式各自记忆状态：月度记 `selectedMonth`（YYYY-MM），年度记 `selectedYear`（YYYY），来回切换互不干扰
- 高亮数据来源：`availableYears`（一次加载）、`availableMonths`（随月份选择器翻页年份加载）

## 4. 明细页（BillsPanel）

- 月度模式：现状不变
- 年度模式：
  - summary-bar 显示「YYYY年 · 共 N 笔 · 支出 X · 收入 Y」
  - 右侧新增月份筛选下拉（`全部` + 1~12 月，样式与现有分类筛选一致）
  - 数据源 `yearRecords`，前端按月份前缀过滤；`全部` 时展示全年按天分组长列表
  - 排序：日期倒序（与现状一致）

## 5. 统计页图表（BillsCharts）

移除统计页内「本月/全年」按钮，范围由侧栏模式决定。

月度视图（4 块，现状保持）：
1. 统计卡（总支出/总收入/结余）
2. 分类支出占比环形图
3. 每日支出柱状图
4. 近6个月支出对比柱状图（**修复**：真实查询前 5 月数据）

年度视图（5 块，新增）：
1. 统计卡（全年聚合）
2. 分类支出占比环形图（全年）
3. 月度支出柱状图（12 个月，现状已有）
4. 每日支出折线图（全年 365 天，x 轴自动间隔 label，tooltip 显示日期与金额，无数据显示「暂无支出数据」）
5. 近6年支出对比柱状图（前 5 年 + 当年）

组件改动：
- 新增 prop `windowTotals: Array<{ period: string; total: number }>`（近6月：period='YYYY-MM'；近6年：period='YYYY'）
- 注册 ECharts `LineChart`，折线图独立实例与 DOM 容器
- 年度模式不再 dispose window 图表，改为渲染「近6年对比」；近6月/近6年复用同一窗口图表实例
- 延续现有机制：CSS 变量读主题色、resize、data-theme MutationObserver、空数据占位

## 6. 数据层与状态

新增 IPC 通道（高亮标记用）：

| 通道 | 参数 | 返回 |
|---|---|---|
| `bills:list-years` | `{ workspacePath }` | `string[]` 有数据的年份 |
| `bills:list-months` | `{ workspacePath, year }` | `string[]` 该年有数据的月份（YYYY-MM） |

主进程 service 实现：
- `SELECT DISTINCT substr(date, 1, 4) FROM bills ORDER BY 1`
- `SELECT DISTINCT substr(date, 1, 7) FROM bills WHERE date LIKE ? ORDER BY 1`

preload、`src/types/api.ts`（DairyApi）、`src/shared/ipc-channels.ts` 同步补齐。

useBillsPanel.ts 状态扩展：
- `statsMode: 'month' | 'year'`（原 `statsScope` 移除/替换）、`selectedYear`（年度模式选中年份）
- `windowTotals`：随模式/年份变化并行查询并前端聚合：
  - 月度：近 6 个月各 `listBillsByMonth` → 每月支出总额
  - 年度：近 6 年各 `listBillsByYear` → 每年支出总额
- `detailMonthFilter: 'all' | '01'..'12'`（年度明细月份筛选）
- `availableYears: string[]`、`availableMonths: Set<string>`（数据标记）

依赖联动：`AppShellPage.vue` 中 BillsSidebar/BillsPanel 双向绑定同步调整（selectedMonth / selectedYear / statsMode），无主进程配置改动。

## 7. 修复：近6个月支出对比 bug

现状 `BillsCharts` 的 monthWindow 用当月 `dailyExpense` 计算前 5 个月，恒为 0。修复方式：窗口月份（前 5 月 + 当月）并行调用 `listBillsByMonth`，前端聚合每月总额，经 `windowTotals` prop 传入图表。

## 8. 测试与验证

纯逻辑（vitest，tests/bills/）：
- 近 6 月窗口期推导（含跨年边界）
- 近 6 年窗口期推导
- 年度明细月份过滤逻辑

主进程 service：不写单测（better-sqlite3 Electron ABI，遵循 AGENTS 约定）。

手工验证：
- 月度模式行为与现状一致，近6月对比图前 5 月有真实数据
- 年度模式：切年份 → 统计 5 块图表数据正确、明细长列表与月份筛选正常
- 月份/年份网格有数据高亮正确
- 模式来回切换状态不串；空数据年份显示「暂无支出数据」
- 深浅主题图表颜色正常
- `npm run build`、`npm run dev` 冒烟

## 9. 改动文件清单

- `src/components/bills/components/BillsSidebar/BillsSidebar.vue` + `.css`
- `src/components/bills/composables/useBillsSidebar.ts`
- `src/components/bills/components/BillsPanel/BillsPanel.vue` + `.css`
- `src/components/bills/composables/useBillsPanel.ts`
- `src/components/bills/components/BillsCharts/BillsCharts.vue` + `.css`
- `src/types/bills.ts`、`src/types/api.ts`、`src/shared/ipc-channels.ts`
- `electron/preload.ts`
- `electron/main/bills/service.ts`、`electron/main/ipc/bills.ts`
- `src/app/pages/AppShellPage.vue`（绑定联动）
- `tests/bills/`（新增用例）

## 10. 明确不做

- 不做跨年自定义区间选择（与报告页的自定义区间不同）
- 不改支出/收入统计口径（仍只统计支出；transfer 不计）
- 不改 SQLite schema、不改导出行为
- 窗口图表只做柱状对比（不做折线/叠加等变体）
