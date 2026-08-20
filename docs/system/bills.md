# dAiry 记账（Bills）文档

## 概览

记账功能管理用户的日常收支流水：录入/编辑/删除账单、按分类管理、月度/年度明细浏览、统计图表与 Excel 导出。账单数据存储在 `<workspace>/bills/bills.db`（SQLite），分类库存储在 `<workspace>/.dairy/bill-categories.json`。

```
BillsSidebar（侧栏：月度/年度切换 + 分类管理 + 导出）
BillsPanel（主区：明细 tab + 统计 tab）
  ├─ 明细：按天分组列表 + 分类/月份筛选
  └─ 统计：统计卡 + 环形图 + 柱状图 + 折线图 + 窗口对比图
        │
        ▼
window.dairy.*（preload）→ IPC（bills:*）→ service → SQLite / 分类 JSON
```

架构要点：

- 本地 Markdown 与账单无关，账单是独立的 SQLite 数据，两者互不影响
- 金额以「分」整数存储（`amount_cents`），支出为负数、收入为正数；UI 显示保留 2 位小数
- **统计在前端聚合**：主进程只提供原始记录查询，所有汇总/图表数据由渲染进程计算
- 分类解析采用「符号优先 + 名字兜底」三步匹配，删除分类不改写历史账单

---

## 一、数据存储

### 1.1 账单数据库

| 文件 | 路径 | 说明 |
|------|------|------|
| 账单数据库 | `<workspace>/bills/bills.db` | SQLite（better-sqlite3），WAL 模式 |

Schema v1（`electron/main/bills/db.ts:45`）：

```sql
CREATE TABLE bills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,          -- 'YYYY-MM-DD'
  amount_cents  INTEGER NOT NULL,          -- 分；支出负数，收入正数
  category      TEXT    NOT NULL,          -- 分类名（冗余存储，见 1.2）
  note          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);
CREATE INDEX idx_bills_date ON bills(date);
```

连接管理：

- 连接缓存 `Map<workspacePath, Database>`（`db.ts:65`）
- `getBillsDatabase`（`db.ts:67`）：文件不存在返回 `null`（读取场景返回空数组）
- `ensureBillsDatabase`（`db.ts:83`）：不存在则创建（首次写账单时调用）
- `closeBillsDatabase`（`db.ts:94`）：关闭并移除缓存

### 1.2 分类库

| 文件 | 路径 | 说明 |
|------|------|------|
| 分类库 | `<workspace>/.dairy/bill-categories.json` | 内置 + 自定义分类，物理删除 |

```json
{
  "version": 1,
  "categories": [
    { "type": "expense", "name": "餐饮", "color": "#5E8C61", "icon": "utensils", "builtin": true },
    { "type": "income", "name": "工资", "color": "#5A9F61", "icon": "wallet", "builtin": true }
  ]
}
```

- 内置分类（`src/types/bills.ts` 的 `BUILTIN_CATEGORIES`）不可改名/删除
- 自定义分类：图标固定为 `tag`，颜色由 `pickPaletteColor` 从 `DEFAULT_CATEGORY_PALETTE` 自动分配未使用色
- 账单表里的 `category` 字段保存的是**分类名快照**（冗余存储），分类改名/删除不影响数据库，展示时经 `resolveCategory` 解析

### 1.3 金额约定

| 类型 | amount_cents | 说明 |
|------|--------------|------|
| expense | 负数（如 `-2346` = -23.46 元） | 计入支出 |
| income | 正数 | 计入收入 |
| transfer | 任意符号 | 不计入收支统计（理财等） |

---

## 二、IPC 链路

通道常量：`src/shared/ipc-channels.ts:62-74` → preload 桥接（`electron/preload.ts:137-148`）→ handler（`electron/main/ipc/bills.ts`）→ service。

| 通道常量 | 通道值 | 用途 | 返回值 |
|----------|--------|------|--------|
| `listBillsByMonth` | `bills:list-month` | 某月账单 | `Bill[]` |
| `listBillsByYear` | `bills:list-year` | 某年账单 | `Bill[]` |
| `listBillsYears` | `bills:list-years` | 有数据的年份列表 | `string[]` |
| `listBillsMonths` | `bills:list-months` | 某年有数据的月份列表 | `string[]` |
| `createBill` | `bills:create` | 新建账单 | `Bill` |
| `updateBill` | `bills:update` | 编辑账单 | `Bill` |
| `deleteBill` | `bills:delete` | 删除账单 | `void` |
| `getBillCategories` | `bills:get-categories` | 分类列表 | `BillCategory[]` |
| `createBillCategory` | `bills:create-category` | 新增分类 | `BillCategory[]`（全量） |
| `renameBillCategory` | `bills:update-category` | 重命名分类 | `BillCategory[]`（全量） |
| `deleteBillCategory` | `bills:delete-category` | 删除分类 | `BillCategory[]`（全量） |
| `exportBillsExcel` | `bills:export-excel` | 导出 Excel | `BillsExportResult` |

`listBillsYears`/`listBillsMonths` 是轻量查询，供侧栏月份/年份网格的「有数据」高亮标记，不返回记录本身。

---

## 三、账单 CRUD（service 层）

`electron/main/bills/service.ts`：

| 函数 | 位置 | 说明 |
|------|------|------|
| `listBillsByMonth` | `service.ts:42` | `WHERE date LIKE 'YYYY-MM-%'`，倒序 |
| `listBillsByYear` | `service.ts:57` | `WHERE date LIKE 'YYYY-%'`，倒序 |
| `listBillsYears` | `service.ts:72` | `SELECT DISTINCT substr(date,1,4)` |
| `listBillsMonthsOfYear` | `service.ts:83` | 年份正则校验 + `WHERE date LIKE 'YYYY-%'` |
| `getAllBills` | `service.ts:98` | 全量（供导出），日期升序 |
| `createBill` | `service.ts:107` | 校验 + INSERT + 回查 |
| `updateBill` | `service.ts:123` | 校验 + UPDATE + 回查 |
| `deleteBill` | `service.ts:144` | 按 id 删除 |

写操作校验（`normalizeRecordInput` + `assertCategoryExists`）：

- 日期必须为真实存在的 `YYYY-MM-DD`（`assertValidDate`）
- 金额为非零整数、绝对值 ≤ 999999999 分（`assertValidAmountCents`）
- 备注 ≤ 200 字符（`assertValidNote`）
- 分类必须存在于分类库（`resolveCategory` fallback 时抛错），避免脏数据

---

## 四、分类管理

`electron/main/bills/categories.ts`：

| 函数 | 位置 | 说明 |
|------|------|------|
| `getBillCategories` | `categories.ts:23` | 读取 JSON，文件缺失/损坏时回退内置分类 |
| `saveBillCategories` | `categories.ts:39` | 写回 JSON（自动建 `.dairy/` 目录） |
| `createBillCategory` | `categories.ts:66` | 校验空名/长度/重名 → 分配颜色 → 追加 |
| `renameBillCategory` | `categories.ts:93` | 校验非内置/重名 → 更新 JSON |
| `deleteBillCategory` | `categories.ts:120` | 校验非内置/非「其他」→ 物理删除 |

### 4.1 分类解析（三步匹配）

`resolveCategory`（`src/shared/bills-logic.ts:29`）：

1. 按「金额符号对应类型 + 分类名」精确匹配
2. 按分类名兜底匹配（如 transfer 的「理财」记录，金额符号不定）
3. 全部失败 → 回退「其他」分类样式（`fallback: true`）

### 4.2 重命名语义（同步历史账单）

重命名分类（`service.ts:156` `updateCategory`）会**同步改写历史账单**：

- 先更新分类库 JSON（含全部校验，失败时不动数据库）
- 再 `UPDATE bills` 按类型精确匹配：
  - `expense`：`WHERE category = ? AND amount_cents < 0`
  - `income`：`WHERE category = ? AND amount_cents > 0`
  - `transfer`：金额符号不定，按分类名全量更新
- 账单 `updated_at` 同步刷新；无账单库时自动跳过

### 4.3 删除语义（不改写数据库）

删除分类是物理删除，**历史账单保留原分类名**，展示时经 `resolveCategory` 兜底为「其他」样式。这是有意设计：保留历史数据原始归属、误删后重建同名分类可自动恢复。

---

## 五、统计与图表（前端聚合）

### 5.1 状态与数据流（`useBillsPanel.ts`）

| 状态 | 说明 |
|------|------|
| `selectedMonth` | 月度模式选中月份（`YYYY-MM`） |
| `selectedYear` | 年度模式选中年份（number） |
| `statsMode` | `month` / `year`（侧栏切换） |
| `detailMonthFilter` | 年度明细月份筛选（`all` 或 `01`..`12`） |
| `monthRecords` | 当月账单（`bills:list-month`） |
| `yearRecords` | `statsYear` 年份账单（`bills:list-year`） |
| `windowTotals` | 近 6 月/近 6 年每期支出+收入总额，`{ period, total, income }[]` |

关键联动：

- `statsYear` = 年度模式取 `selectedYear`，月度模式取 `selectedMonth` 的年份 → 决定 `yearRecords` 加载
- `detailRecords` = 年度模式按 `detailMonthFilter` 过滤 `yearRecords`（`filterBillsByMonth`）；月度模式直接用 `monthRecords`
- `statsRecords` = 统计视图数据源（月度/年度二选一）
- 所有加载带自增序列号防竞态（快速切换时旧响应不覆盖新数据）

### 5.2 窗口对比数据（`reloadWindowTotals`，`useBillsPanel.ts:236`）

「近6个月/近6年支出对比」与「近6个月/近6年收入对比」图的数据来源：前端**并行调用** 6 次 `listBillsByMonth`/`listBillsByYear`，再用 `expenseTotal`/`incomeTotal` 聚合每期支出与收入总额，同一次请求同时产出两份统计。这是修复过的逻辑——早期版本误用当月记录计算窗口导致前 5 个月恒为 0。

- 月度窗口：`buildMonthWindow(selectedMonth, 6)`（含跨年）
- 年度窗口：`buildYearWindow(selectedYear, 6)`
- 切换模式时先清空 `windowTotals` 再加载，避免格式混用

### 5.3 图表（`BillsCharts.vue`）

ECharts 6 按需注册（Bar/Line/Pie + Grid/Legend/Tooltip + CanvasRenderer），主题色从 CSS 变量读取（`readCssColor`），支持深色主题实时切换（MutationObserver 监听 `data-theme`）。支出图表统一绿色（`--color-chart-positive`）、收入图表统一蓝色（`--color-chart-income`），空态文案分别为「暂无支出数据」/「暂无收入数据」。

| 视图 | 图表块 |
|------|--------|
| 月度 | 统计卡（总支出/总收入/结余）+ 分类支出占比环形图 + 每日支出柱状图 + 近6个月支出对比 + 近6个月收入对比 |
| 年度 | 统计卡 + 环形图（全年）+ 月度支出柱状图（12 月）+ 每日支出折线图（全年 365/366 天）+ 近6年支出对比 + 月度收入柱状图（12 月）+ 近6年收入对比 |

- 支出图表只统计支出、收入图表只统计收入；`transfer` 不计入
- 收入图表点击跳转与支出图表一致（对比图→对应月/年、月度收入→对应月）
- 结余 = 收入 − 支出，显示带符号金额（`formatCents`）
- 每日折线图 x 轴每月 1 号 + 首尾显示刻度（`buildDailyAxis` + interval 回调）
- 空数据区块显示「暂无支出数据」/「暂无收入数据」占位

### 5.4 侧栏数据标记（`useBillsSidebar.ts`）

- `availableYears`/`availableMonths`：`listBillsYears`/`listBillsMonths` 查询，随工作区切换、月份选择器翻页、`refreshTick`（账单增删改后由 AppShell 递增）刷新
- 月份网格 `picker-cell--has-data`、年份网格（`YearPickerGrid` 的 `hasDataYears`）高亮有数据的周期
- 高亮查询失败静默降级，不影响选择器使用

---

## 六、前端组件结构

| 组件 | 职责 |
|------|------|
| `BillsSidebar.vue` | 侧栏：月度/年度 tab、月份网格（高亮）、`YearPickerGrid`（年份网格）、分类管理（tab + 增删改）、导出 Excel 按钮 |
| `BillsPanel.vue` | 主区：明细/统计 tab、summary-bar（期间汇总 + 月份/分类筛选）、记一笔按钮 |
| `BillsCharts.vue` | 统计图表（ECharts，见 5.3） |
| `BillsRecordModal.vue` | 录入/编辑模态框：类型 tab、日期、金额、分类下拉、备注；编辑态可删除 |
| `BillsRenameModal.vue` | 分类重命名模态框（输入框预填原名单选、Enter 确认、Esc/遮罩关闭） |
| `BillsCategorySelect.vue` | 分类下拉：图标/颜色/分组/可清除，Teleport 自适应弹出 |
| `AppSelect.vue` | 通用下拉（`src/components/shared/`）：`{ label, value, icon?, color?, group? }` 选项模型，设置页与记账共用 |
| `useBillsPanel.ts` / `useBillsSidebar.ts` | composable：状态、数据加载、增删改、导出 |

明细页：

- 月度：当月按天分组（`groupBillsByDay`，日期倒序）
- 年度：全年按天分组长列表 + 月份筛选（数据过滤，走 `detailMonthFilter`）+ 分类筛选（呈现层过滤，组件内 `categoryFilter`）
- 深色模式下分类图标背景色经 `src/shared/theme/dark-icons.css` 内阴影压暗，不影响白色图标

---

## 七、Excel 导出

`electron/main/bills/export.ts`：

| 函数 | 位置 | 说明 |
|------|------|------|
| `buildBillsWorkbook` | `export.ts:7` | 纯函数：按年份分 sheet，表头「日期/金额/分类/备注」，金额分→元，日期升序 |
| `exportBillsExcel` | `export.ts:44` | 全量读取 → 构建 workbook → 保存对话框（默认文件名「个人账单.xlsx」）→ 写盘 |

- 导出是展示能力，不改变账单数据
- `buildBillsWorkbook` 无 Electron 依赖，可单测

---

## 八、测试

`tests/bills/`（vitest，共 67 用例）：

| 文件 | 覆盖 |
|------|------|
| `logic.test.ts` | `resolveCategory` 三步匹配、`aggregateRecords`（transfer 排除）、金额格式化、校验函数、调色板 |
| `window.test.ts` | 窗口期推导（跨年）、支出/收入总额、月份过滤、闰年、全年日期序列 |
| `export.test.ts` | `buildBillsWorkbook` 按年分 sheet/排序/空数据 |
| `smoke.test.ts` | 冒烟 |

约定：better-sqlite3 为 Electron ABI 编译产物，Node 环境（vitest）不可加载，**db 层与 service 层不写单测**；可测逻辑下沉到 `src/shared/bills-logic.ts`。

---

## 九、关键函数位置

| 函数 | 文件 | 说明 |
|------|------|------|
| `openBillsDatabase` / `migrate` | `electron/main/bills/db.ts:30/45` | 打开库 + schema v1 迁移 |
| `getBillsDatabase` / `ensureBillsDatabase` | `electron/main/bills/db.ts:67/83` | 读取/创建连接（带缓存） |
| `listBillsByMonth` / `listBillsByYear` | `electron/main/bills/service.ts:42/57` | 月度/年度查询 |
| `listBillsYears` / `listBillsMonthsOfYear` | `electron/main/bills/service.ts:72/83` | 数据标记查询 |
| `createBill` / `updateBill` / `deleteBill` | `electron/main/bills/service.ts:107/123/144` | CRUD |
| `updateCategory` | `electron/main/bills/service.ts:156` | 重命名分类 + 同步历史账单 |
| `getBillCategories` / `saveBillCategories` | `electron/main/bills/categories.ts:23/39` | 分类库读写 |
| `createBillCategory` / `renameBillCategory` / `deleteBillCategory` | `electron/main/bills/categories.ts:66/93/120` | 分类增删改 |
| `buildBillsWorkbook` / `exportBillsExcel` | `electron/main/bills/export.ts:7/44` | Excel 导出 |
| `resolveCategory` / `aggregateRecords` | `src/shared/bills-logic.ts:29/66` | 分类解析 / 收支聚合 |
| `buildMonthWindow` / `buildYearWindow` | `src/shared/bills-logic.ts:135/151` | 窗口期推导 |
| `expenseTotal` / `incomeTotal` | `src/shared/bills-logic.ts:156/166` | 支出总额 / 收入总额 |
| `filterBillsByMonth` / `isLeapYear` / `buildDailyAxis` | `src/shared/bills-logic.ts:197/224/228` | 月份过滤 / 闰年 / 全年日期序列 |
| `useBillsPanel` | `src/components/bills/composables/useBillsPanel.ts:29` | 面板状态与数据加载 |
| `useBillsSidebar` | `src/components/bills/composables/useBillsSidebar.ts:37` | 侧栏状态、数据标记、分类管理 |
| `registerBillsIpcHandlers` | `electron/main/ipc/bills.ts:27` | IPC 注册入口 |

---

## 十、架构约束

- **统计在前端聚合**：主进程只提供原始记录查询，汇总计算在渲染进程/共享纯逻辑完成
- **分类名为快照**：账单表冗余存储分类名，展示经三步匹配解析，兜底「其他」
- **删除不改写历史**：删除分类只动分类库，历史账单按符号兜底；重建同名分类可自动恢复
- **重命名同步历史**：重命名分类时按类型精确改写历史账单，避免误改同名分类
- **金额整数分存储**：UI 输入元换算到分（`toCentsFromInput`），显示保留 2 位小数
- **transfer 不计收支**：统计、图表、结余全部排除
- **写操作全量校验**：日期/金额/备注/分类在 service 层校验后才落盘
- **首写建库**：读取时数据库文件不存在返回空数组，首次写账单才创建
- **渲染进程不直接读写文件**：所有数据访问经 IPC 由主进程完成
