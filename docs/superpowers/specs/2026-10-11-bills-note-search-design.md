# 记账备注搜索设计（全局搜索）

日期：2026-10-11
状态：已确认（2026-10-11，reviewer 复核后定稿；实施计划见 `docs/superpowers/plans/2026-10-11-bills-note-search.md`；2026-10-11 修订为实时搜索，见 §十一）

## 背景与目标

记账页当前只能按月/年翻看。用户的两个真实诉求：

1. **忘了哪一年/哪个月买的**——例如"前段时间买了个鼠标，忘了多少钱"，想靠一个词把账找出来；
2. **复用旧账快速记一笔**——例如"上次吃了手撕鸡，这次懒得打字"，想找到上次那条，用现有的「复制到今天」快速记一笔。

两者都是"记得一个词、不记得时间"的跨期检索，因此搜索必须覆盖**全部历史**，而不是只看当前列表。目标：在**不新增页面**的前提下，给「明细」tab 加一个常驻搜索框，输入即在原位把列表切换成跨年结果列表（防抖 300ms）；结果直接复用现有记账行的交互（点击打开编辑弹窗，含「复制到今天」）。

## 一、非目标（明确不做）

- 不搜分类名（分类筛选已有；搜索只匹配备注）、不搜金额/日期
- 不做搜索历史 / 最近搜索 / 热门词
- 不做 FTS5 或额外索引优化（个人规模，全表 LIKE 扫描足够）
- 不做统计 tab 内搜索（搜索框只属于明细 tab）
- 不引入跨模块全局搜索（日记 + 账单等）
- 不改 MCP 的 `dairy_bills_query` / `queryBills`（独立消费方，语义保持）
- 除 Ctrl+F 外不加其他快捷键
- 导出 Excel 保持全量导出，不受搜索影响

## 二、已定决策（讨论结论速览）

| # | 决策 |
|---|------|
| 1 | 入口：明细 tab 工具栏常驻搜索框，placeholder「全局搜索」；统计 tab 不显示 |
| 2 | **输入即搜**（防抖 300ms，输入法组合结束后提交；VS Code 风格）；回车=立即搜索（失败可重试）；输入清空即退出；Esc / ✕ / 摘要条「清除」退出；不显示 `⏎` 提示 |
| 3 | 搜索范围：全部时间；只匹配备注（子串，trim、ASCII 不区分大小写）；命中词高亮 |
| 4 | 搜索时隐藏"月份筛选 / 分类筛选"（周期过滤与全时间搜索不同维度），退出后原样恢复 |
| 5 | 分页：首批 30 条，「查看更多（剩余 N 笔）」+30；记录按"日边界对齐"（日期组小计永远完整） |
| 6 | 弹窗操作（保存/删除/复制）**不重查数据库**，就地更新已加载窗口 + 统计差额；删除类操作后补位 |
| 7 | 退出触发：切统计 tab、切其他页面、侧栏点月份/年份/「回到本月」/月度-年度切换/年度月份筛选、工作区切换 |
| 8 | 浏览状态（选中月份/年度）不因搜索清空而改变——退出即回到搜索前的浏览位置 |
| 9 | Ctrl+F 仅账单页生效（其他页面无反应）；统计 tab、弹窗打开时不响应 |

## 三、交互规格

### 3.1 入口与布局（`BillsPanel.vue`）

明细 tab 工具栏（现有 `[明细|统计] … [＋记一笔]`）变为：

```
[明细 | 统计] … [🔍 ______ ✕] [＋ 记一笔]
```

- 搜索框结构：容器 `.search-field`（`margin-left:auto` 靠右）+ `Search` 图标（lucide）+ `<input>` + `✕` 清除钮（输入非空时显示）。
- 宽度约 220–240px；视觉沿用主题 token（与 `AppSelect`、`.add-button` 同一套变量），深色主题自适应。

### 3.2 提交与退出

| 触发 | 行为 |
|------|------|
| 输入文字（停止输入 300ms 后） | 自动搜索：进入搜索态、加载第一页；关键词与当前结果一致且无错误时不重复触发 |
| 输入法组合中 | 不提交中间文本；组合结束后提交最终文本并按防抖搜索（`compositionstart/end` + `KeyboardEvent.isComposing` 双守卫） |
| 输入清空（含纯空格） | 立即退出搜索（不等防抖） |
| 回车（非输入法组合中） | 跳过防抖立即搜索当前输入；关键词已是当前结果且无错误时无操作；失败后可回车重试 |
| Esc（焦点在搜索框内） | 清空输入并退出搜索 |
| ✕ 按钮 | 清空输入并退出搜索（未搜索时仅清输入） |
| 摘要条「清除」 | 退出搜索 |
| 切换到「统计」tab | 退出搜索（输入文字一并清掉） |
| 切换其他页面（写日记等，含通知点击/托盘菜单导航）后返回 | 搜索已退出；浏览状态保持原月份/年度 |
| 侧栏点月份 / 年份 / 「回到本月」/ 月度-年度切换 / 年度内月份筛选 | 退出搜索，并进入该周期普通浏览；**点当前已选中的月份同样退出**（动作本身代表浏览意图） |
| 切换工作区 | 退出搜索（整页数据重置） |

实现要点：退出动作统一收敛为 `exitSearch()`。输入即搜由 `watch(searchInput)` + 300ms 防抖实现（关键词未变且无错误时跳过）；周期类导航由 AppShell 在**事件回调里调用**（不用 watch——同值点击不会触发）；"离开记账页"用 `rightPanel` 过渡 watcher 统一兜底（见 4.6）。退出时同步清空输入框未提交文字。

### 3.3 搜索态界面

- **摘要条**（替换原周期摘要）：
  - 加载中：`搜索「关键词」 · 搜索中…`
  - 完成：`[搜索「关键词」] 全部时间 · 共 N 笔 · 支出 ¥x,xxx.xx · 收入 ¥x,xxx.xx`，右侧「清除」
  - `共 N 笔 / 支出 / 收入`均为**全部匹配**的口径，不是已加载窗口的口径
- **结果列表**：与现有明细完全同构——按天分组（`groupBillsByDay`，日期倒序）、同样的行样式（图标 / 分类 / 备注 / 金额）、可点击打开编辑弹窗、支持键盘 Enter/Space。
  - 日期组标题：当年显示 `M月D日 星期X`（现状不变）；**非当年加年份前缀** `YYYY年M月D日 星期X`（跨年检索需要）
  - 备注命中词高亮（大小写不敏感命中，显示原文；多处命中多处高亮）
- **加载 / 空 / 错误态**：
  - 首次搜索（窗口为空）加载中：列表区占位「正在搜索…」；已有旧结果时保留显示直至响应返回，避免实时输入过程中列表闪烁
  - 无结果：占位「没有找到包含「关键词」的账单」
  - 失败：列表区显示可读错误（复用 `getReadableErrorMessage`），保留关键词与输入，可回车重试
- **查看更多**：底部居中按钮，文案 `查看更多（剩余 {N} 笔）`；点击后按钮变为「加载中…」且禁用；加载更多不改变列表已展示内容、不跳滚动位置。新搜索提交后列表滚动回顶部。

### 3.4 分页模型

- 每批 `BILLS_SEARCH_PAGE_SIZE = 30`；首次 `offset = 0`，「查看更多」`offset = 已加载条数`，`limit = 30`。
- **日边界对齐**：取数时若第 30 条与其后一条同日期，继续取该日期剩余匹配记录，直到跨日或取尽。返回条数可能略多于 30。保证每个日期组头的"当日支出/收入小计"永远基于完整的当天记录。
- 剩余数 = `total（全量匹配数） − 已加载条数`；为 0 时按钮消失。
- 已加载窗口的不变量：**窗口 = 匹配集按 (date DESC, id DESC) 的前 K 条，且末条为其所在日期在匹配集中的最后一条**（见第五节论证）。

### 3.5 操作后就地更新（无重查）

**统计口径恒定镜像匹配集 M**：摘要条的 `共 N 笔 / 支出 / 收入` 永远等于"全部匹配"的口径；一条记录是否进入已加载窗口只影响 `records` 列表，不影响统计。

弹窗里的保存 / 删除 / 复制在搜索态下的处理（**不重新查询数据库**）：

| 操作 | 窗口（records） | 统计（total / 收支） |
|------|-----------------|----------------------|
| 「复制到今天」 | 命中且能按排序进入窗口 → 插入（今天的在顶部）；否则不插入 | 命中 → total+1、按贡献加减（无论是否进窗）；不命中 → 不变 |
| 「记一笔」新建 | 同上（日期任意，能排进窗口则插入） | 同上 |
| 编辑保存 | 仍匹配 → 能排进窗口则替换重排；排序位置到达/超出窗口末位则移出窗口（移除）；改到不再匹配 → 移除 | 仍匹配 → 仅应用"新贡献 − 旧贡献"（total 不变）；不再匹配 → total−1、减旧贡献 |
| 删除 | 移除 | total−1、减旧贡献 |

- 记录贡献口径与 `aggregateRecords` 完全一致：`resolveCategory` 后 transfer 不计；否则按金额符号计入收入/支出（分）。
- **补位**：发生"移除"且 `total > 已加载条数` 时，用 `offset = 已加载条数, limit = 1` 补取一条（同样按日对齐），追加到窗口尾，恢复窗口大小与日边界。补位失败静默（窗口暂时少 1，不影响后续「查看更多」的正确性）。
- 这些更新全部是纯函数（4.4），可单测。
- 窗口大小会随插入 / 补位小幅浮动（以"天"为最小波动单位），不保证精确等于 30 的整数倍（这是日对齐的代价，可接受）。

### 3.6 Ctrl+F

- 全局 `keydown` 监听沿用 `AppShellPage.vue` 现有模式（`handleGlobalKeydown`，按 `rightPanel` 分支）。
- 在账单页（`rightPanel === 'bills'`）且 `Ctrl/Cmd+F`（无 Alt/Shift）时：`preventDefault()`，调用 `BillsPanel` 暴露的 `focusSearchInput()`。
- `focusSearchInput()` 内部守卫：非「明细」tab 或弹窗打开时不动作；聚焦后 `select()` 全选现有文字。
- 其他页面一律无反应。后续其他页面的快捷键在同一处理器里继续扩展。

### 3.7 联动与已知边界

- **分类重命名**：主进程会同步改写历史账单。搜索态下已加载窗口里的同类记录**就地改名**（规则见 4.4 `applyCategoryRenameToBill`）；改名不改变记录类型，金额统计不受影响。
- **分类删除 / 新增**：记录的展示样式与收支归属随 `resolveCategory` 解析实时变化（典型：删除自定义 transfer 分类后，相关记录回退为按符号计收支；给原本"回退"的记录补建同名分类也会改变类型）。因此搜索态下**任何分类变更**都会在分类重载后静默刷新一次全量统计（见 4.5），保证摘要条与每日小计当场一致；样式回退本身无需处理（渲染实时解析）。
- **外部写入**（如 MCP 并发写库）：搜索窗口不感知，下次搜索/加载即正确。不做实时订阅。
- **极端可接受项**：编辑把日期改到窗口末位之外时，按"移出窗口"处理（移除 + 补位），该记录会在继续加载后重新出现；此类编辑导致的日边界不完美不额外校正。

## 四、技术设计

### 4.1 分层总览

```
BillsPanel.vue（搜索框 / 摘要条 / 结果列表 / 查看更多 / focusSearchInput）
   │ props + emits（见 4.6）
   ▼
useBillsPanel.ts（searchInput / searchKeyword / searchWindow / loading / 序列号守卫）
   │ window.dairy.searchBills()          ┐
   │ bills-logic 纯函数（就地更新/匹配）   ┘ 新搜索与分页走 IPC；变更就地算
   ▼
electron/preload.ts → electron/main/ipc/bills.ts → electron/main/bills/service.ts
   │ SQL: WHERE note LIKE ? ESCAPE '\' ORDER BY date DESC, id DESC LIMIT/OFFSET
   │ 汇总: 同一 WHERE 用 iterate() 全量流式聚合（不物化大数组）
   ▼
<workspace>/bills/bills.db（SQLite）
```

沿用仓库约束：渲染进程不直接访问文件；统计口径由共享纯逻辑保证与服务端一致；better-sqlite3 为 Electron ABI，db/service 不写单测，可测逻辑下沉 `src/shared/bills-logic.ts`。

### 4.2 类型与 IPC

`src/types/bills.ts` 新增：

```ts
export interface BillsSearchInput {
  workspacePath: string
  keyword: string
  offset: number
  limit: number
}

export interface BillsSearchResult {
  records: Bill[]   // 当前页（已按日边界对齐）
  total: number     // 全部匹配数
  income: number    // 全量口径，分（与 aggregateRecords 一致，transfer 不计）
  expense: number   // 同上
}

// 搜索态窗口（渲染层状态，纯逻辑复用）
export interface BillsSearchWindow {
  records: Bill[]
  total: number
  income: number
  expense: number
}

// 弹窗保存结果（BillsRecordModal → Panel → AppShell → composable）
export type BillsSavedPayload =
  | { kind: 'create'; bill: Bill }                 // 记一笔
  | { kind: 'duplicate'; bill: Bill }              // 复制到今天
  | { kind: 'update'; previous: Bill; bill: Bill } // 编辑保存

// 搜索态下要应用的就地变更（= 保存类 + 删除）
export type BillsSearchMutation = BillsSavedPayload | { kind: 'delete'; bill: Bill }

// 侧栏分类变更（用于重命名的就地改名）
export type BillsCategoryChange =
  | { kind: 'create'; type: BillType; name: string }
  | { kind: 'rename'; type: BillType; oldName: string; newName: string }
  | { kind: 'delete'; type: BillType; name: string }
```

链路：
- `src/shared/ipc-channels.ts`：`searchBills: 'bills:search'`
- `electron/preload.ts`：`searchBills: (input) => ipcRenderer.invoke(IPC_CHANNELS.searchBills, input)`
- `src/types/api.ts`：`searchBills: (input: BillsSearchInput) => Promise<BillsSearchResult>`
- `electron/main/ipc/bills.ts`：注册 handler 直通 service

### 4.3 主进程 service（`electron/main/bills/service.ts`）

```ts
export async function searchBills(input: BillsSearchInput): Promise<BillsSearchResult>
```

行为：

1. 校验：`keyword.trim()` 非空，否则抛「搜索关键词不能为空。」；`offset ≥ 0`、`limit` 夹取到 `[1, 100]`。
2. **汇总**：`SELECT id, date, amount_cents, category, note, created_at, updated_at FROM bills WHERE note LIKE ? ESCAPE '\' ORDER BY date DESC, id DESC` 用 `.iterate()` 逐行 → `mapRowToBill` → 用 `billSearchContribution`（读 `getBillCategories`）累加 `total / income / expense`。不把全量行物化成长数组。
3. **取页**：同 WHERE，`LIMIT ? OFFSET ?`（先取 `limit + 1` 探测）；若探测条与最后一条同日期，继续补取该日期剩余记录（建议 SQL：`AND date = ? AND id < ? ORDER BY id DESC`），直到跨日或取尽。
4. 复用 `escapeLikeKeyword` 转义 `\ % _`；空库（文件不存在）返回 `{ records: [], total: 0, income: 0, expense: 0 }`（沿用 `withExistingBillsDatabase` 语义）。
5. 匹配语义：SQLite `LIKE` 默认对 ASCII 不区分大小写 → 渲染层 `billMatchesKeyword` 必须镜像（统一不区分大小写），保证"就地更新"与"服务端结果"口径一致。

性能注记：`%kw%` 无法走 `idx_bills_date`，是 bills 全表扫描；个人规模（≤ 数万条）下毫秒级，可接受；未来如需再上 FTS5（本次不做）。

### 4.4 纯逻辑（`src/shared/bills-logic.ts` 新增，TDD）

```ts
export const BILLS_SEARCH_PAGE_SIZE = 30

// 备注是否包含关键词。keyword 视为已 trim；空串 false。
// 不区分大小写（ASCII），镜像 SQLite LIKE 默认行为。
export function billMatchesKeyword(note: string, keyword: string): boolean

// 命中词切分（用于高亮渲染）。非正则、按 indexOf 顺序切，大小写不敏感，
// 多处命中全部切出；keyword 为空返回整体一段（hit=false）。
export function splitNoteByKeyword(
  note: string,
  keyword: string,
): Array<{ text: string; hit: boolean }>

// 单条记录的收支贡献（分）。与 aggregateRecords 完全同口径：
// resolveCategory 后 transfer → { 0, 0 }；否则正数计入 income、负数计入 expense。
export function billSearchContribution(
  categories: BillCategory[],
  bill: Bill,
): { income: number; expense: number }

// 分类重命名对单条记录的改写，规则与主进程 updateCategory 的 SQL 一致：
//   transfer: category === oldName → newName
//   expense : category === oldName && amountCents < 0 → newName
//   income  : category === oldName && amountCents > 0 → newName
// 不满足则原样返回。
export function applyCategoryRenameToBill(
  bill: Bill,
  rename: { type: BillType; oldName: string; newName: string },
): Bill

// 就地应用一次变更到搜索窗口。统计恒定镜像匹配集：
//   create/duplicate：命中 → total+1、按贡献加减（无论是否进窗）；能排进窗口则插入
//   update：仍匹配 → 仅应用贡献差额（total 不变），能排进窗口则替换，
//           排序位置到达/超出窗口末位则移出窗口；不再匹配 → 移除 + total−1 + 减贡献
//   delete：移除 + total−1 + 减贡献
// needsRefill = 发生了移除 && 新的 total > 新的 records.length（此时应补位）。
export function applyBillsMutation(
  window: BillsSearchWindow,
  mutation: BillsSearchMutation,
  categories: BillCategory[],
  keyword: string,
): { window: BillsSearchWindow; needsRefill: boolean }
```

排序统一约定：`date DESC, id DESC`（与服务端 ORDER BY 一致）；插入/重排都按此键。

### 4.5 渲染层状态（`src/components/bills/composables/useBillsPanel.ts`）

新增状态：

| 字段 | 说明 |
|------|------|
| `searchInput: Ref<string>` | 输入框文字（未提交） |
| `searchKeyword: Ref<string>` | 已提交关键词；空串 = 非搜索态（`isSearching` 由此派生） |
| `searchWindow: Ref<BillsSearchWindow>` | 已加载窗口 + 全量统计 |
| `isSearchLoading: Ref<boolean>` | 首次 / 重搜加载中 |
| `isSearchLoadingMore: Ref<boolean>` | 「查看更多」加载中 |
| `searchErrorMessage: Ref<string>` | 搜索失败文案（与普通 `statusMessage` 隔离） |
| `searchSequence`（非响应式计数器） | 所有搜索相关异步响应的竞态守卫（沿用现有 `loadSequence` 模式） |
| `searchDebounceTimer`（非响应式） | 实时搜索防抖计时器（300ms；输入停止后触发搜索） |

新增函数：

```ts
function scheduleSearch(): void
// 输入变化触发（watch searchInput）：trim 空 → exitSearch()；关键词与当前结果
// 一致且无错误 → 跳过；否则重置 300ms 防抖计时器，到期 runSearch。

async function runSearch(keyword: string): Promise<void>
// searchKeyword=kw、loading、序列号守卫；fetch(offset=0, limit=30)；
// 响应更新窗口与统计；不清空旧 records（保留至响应返回，避免列表闪烁）。

function submitSearch(): void
// 回车触发：清防抖计时器并立即 runSearch（失败后可重试）；
// 空 → exitSearch()；关键词已是当前结果且无错误 → 无操作。

async function loadMoreSearch(): Promise<void>
// 守卫：非搜索态 / 加载中 / 剩余=0 直接返回；
// fetch(offset=searchWindow.records.length, limit=30) 追加；
// 响应中的 total/income/expense 直接采用（顺带修正任何漂移）。

function exitSearch(): void
// 幂等：序列号自增（使在途响应失效）、清关键词/输入/窗口/loading/错误。

async function refillSearchWindow(): Promise<void>
// fetch(offset=searchWindow.records.length, limit=1)（日对齐）；
// 追加；响应内容覆盖 total/income/expense（以服务端为准）。

async function refreshSearchSummary(): Promise<void>
// 分类变更后静默刷新全量统计：fetch(offset = 已加载条数, limit = 1)，
// 只采纳响应中的 total/income/expense，丢弃 records（窗口内容不动）。

function applySearchMutation(mutation: BillsSearchMutation): void
// 组装 window → applyBillsMutation → 回写；needsRefill 时 void refillSearchWindow()。
```

改动现有函数：

- `handleRecordSaved(payload: BillsSavedPayload)`：关弹窗、`reloadMonthRecords / reloadYearRecords / reloadWindowTotals`（不变）之外，若搜索态则 `applySearchMutation(payload)`。
- `handleDeleteFromModal()`：删除成功后（删除前的 `modalState.editing` 即被删记录）搜索态下 `applySearchMutation({ kind: 'delete', bill })`；`handleDeleteRecord(bill)` 同步接入（保持两个入口一致）。
- `handleCategoriesChanged(change?: BillsCategoryChange)`：分类重载与普通刷新（不变）之外，搜索态下：
  - `rename` → 对 `searchWindow.records` 逐条 `applyCategoryRenameToBill`（就地改名）；
  - 任何变更（create / rename / delete）→ `void refreshSearchSummary()`。分类变更会改变 `resolveCategory` 的解析口径（典型：删除自定义 transfer 分类后，相关记录回退为按符号计收支；给原本"回退"的记录补建同名分类也会改变类型）；每日小计是实时计算，摘要条必须同步刷新，避免两者当场打架。
- `handleWorkspaceChange()`：无工作区分支与正常分支都先 `exitSearch()`。

### 4.6 组件与接线

**`BillsRecordModal.vue`**：捕获写入结果并携带事件（当前丢弃返回值）：

- 编辑保存：`const bill = await window.dairy.updateBill(...)` → `emit('saved', { kind: 'update', previous: props.modalState.editing, bill })`
- 记一笔：`emit('saved', { kind: 'create', bill: await createBill(...) })`
- 复制到今天：`emit('saved', { kind: 'duplicate', bill: await createBill(...) })`
- `deleted` 事件不变（AppShell → composable 用 `modalState.editing` 充当被删记录）

**`BillsPanel.vue`**：

- 新增 props：`searchInput`、`searchKeyword`、`searchRecords`、`searchTotal`、`searchIncome`、`searchExpense`、`isSearchLoading`、`isSearchLoadingMore`；派生 `isSearching / searchRemaining / hasMoreSearch` 在组件内计算。
- 新增 emits：`update:searchInput`、`search-submit`、`search-clear`、`search-load-more`；`record-saved` 改为携带 `BillsSavedPayload`。
- 模板结构（明细分支）：

```html
<template v-if="activeTab === 'detail'">
  <!-- 搜索态摘要条 / 原周期摘要条（互斥） -->
  <template v-if="isSearching"> 搜索摘要条 + 结果区（加载/空/错误/列表/查看更多） </template>
  <template v-else> 现有周期摘要条 + 筛选 + 现有列表 </template>
</template>
```

- 结果区渲染复用 `groupBillsByDay`、行样式、`openEdit`；备注用 `splitNoteByKeyword` 渲染高亮。
- 日期标题函数：`dayLabelForSearch(date)`——非当年加 `YYYY年` 前缀（当年与现有 `dayLabel` 一致）。
- 输入框：`:value` + `@input` 走 `update:searchInput`（`compositionstart/end` 与 `isComposing` 双守卫，组合期间不提交中间文本，组合结束提交最终文本）；`@keydown.enter` 显式处理（`isComposing` 守卫）→ `emit('search-submit')`（立即搜索）；`@keydown.esc` → `emit('search-clear')`。
- `defineExpose({ focusSearchInput })`：守卫（非明细 tab / `modalState.open` 不动作）→ `input.focus(); input.select()`。
- 新搜索提交成功后滚动容器回到顶部（定位实际滚动元素；沿用 `scrollIntoView` 的现有用法定位方式）。

**`AppShellPage.vue`**：

- 模板：为 `BillsPanel` 加 `ref="billsPanelRef"`，透传上述 props/emits。
- `handleBillsRecordSaved(payload)`：tick + `billsPanel.handleRecordSaved(payload)`。
- 退出接线分两类：
  - **周期类导航**（`@update:selectedMonth` / `@update:selectedYear` / `@update:statsMode` / `@update:detailMonthFilter`）：在**事件回调里**先 `billsPanel.exitSearch()` 再赋值（保证点当前已选月份这类"同值"动作也退出；watch 不触发）。
  - **离开记账页**：在 `useAppShell.ts`（与 `rightPanel`、`billsPanel` 同处）用过渡 watcher 统一兜底——`watch(rightPanel, (val) => { if (val !== 'bills') billsPanel.exitSearch() })`。覆盖所有离开路径：活动栏、通知提醒点击、托盘菜单（后两者经 `navigateMainPanel` 直接改 `rightPanel`，不走 `handleActivitySelect`）；"离开"必然伴随值变化，不存在同值问题。
- `handleGlobalKeydown` 重构为按 `rightPanel` 分支：journal 分支保持现状；新增 bills 分支处理 Ctrl/Cmd+F（`preventDefault` + `focusSearchInput()`）。
- `@update:searchInput` / `@search-submit` / `@search-clear` / `@search-load-more` 直通 composable。

**`useBillsSidebar.ts` / `BillsSidebar.vue`**：`categoryChanged` 事件带上 `BillsCategoryChange`：

- 新建 → `{ kind: 'create', type, name }`；重命名 → `{ kind: 'rename', type, oldName: state.name, newName }`；删除 → `{ kind: 'delete', type, name }`。
- AppShell `handleBillsCategoriesChanged(change)` → tick + `billsPanel.handleCategoriesChanged(change)`。

### 4.7 样式

- `BillsPanel.css` 新增：`.search-field` / `.search-input` / `.search-clear` / `.summary-bar--search` / `.search-chip` / `.note-hit`。
- 一律使用主题 token（与 `.summary-bar`、`.add-button`、`AppSelect` 同源变量）；深色主题走同一套变量，不新增特判。
- 搜索结果列表复用现有 `.day-list` / `.day-card` / `.record-row` 样式，不另起一套。

## 五、正确性论证（分页不漏不重）

记号：匹配集 `M` 按 `(date DESC, id DESC)` 排序；窗口 `W` 为已加载前缀；不变量 **I**：`W = M 的前 K 条，且末条为其所在日期在 M 中的最后一条**（日边界）。

1. **取数**保持 I：初始取数按"至少 30 条、补齐至日边界"；「查看更多」从 `offset = K` 续取同理。
2. **插入 / 替换**（复制、新建、编辑仍匹配）：新记录按排序键就位；若位置达到或超出窗口末位则视为"移出窗口"（移除）——避免窗口出现"非前缀"记录导致续取重复。
3. **移除**保持前缀性：删除 M 中第 p (p < K) 条后，M′ 的前 K−1 条恰为 `W ∖ {被删}`；即 `offset = |W|` 仍精确指向"下一条未加载匹配"，不漏不重。
   例：`M = [a,b,c,d,e,f]`，`W = [a,b,c,d]`；删 `b` → `W′ = [a,c,d]`，续取 `offset = 3` 得 `e` ✓。
4. 移除后若 `total > |W|`，补位取一条（日对齐）恢复窗口大小；即使补位失败，`offset = |W|` 续取仍然正确。

## 六、测试计划

### 6.1 单测（`tests/bills/search.test.ts`，vitest）

- `billMatchesKeyword`：中文子串；ASCII 大小写不敏感；空关键词 false；`% _ \` 按字面量匹配；多处命中。
- `splitNoteByKeyword`：单处 / 多处 / 大小写不敏感但保原文 / 无命中 / 空关键词。
- `billSearchContribution`：expense / income / transfer（不计）/ 已删分类回退「其他」按符号计——与 `aggregateRecords` 对同一集合求和的等价性用例。
- `applyBillsMutation` 全场景：复制（匹配 / 不匹配 关键词）、新建（日期任意：能进窗则插入；超出窗口末位不插入但统计仍 total+1）、编辑（仍匹配替换重排 / 仍匹配但移出窗口 / 改到不匹配移除 / previous 不在窗口的防御分支）、删除；**统计恒定镜像匹配集**：未进窗的命中新建仍按贡献加减、"移出窗口"的编辑 total 不变只应用贡献差额；每例断言 `records` 顺序、`total`、`income`、`expense`、`needsRefill`。
- `applyCategoryRenameToBill`：transfer 无视符号改名；expense 仅负数改名；income 仅正数改名；旧名不匹配原样。
- 常量：`BILLS_SEARCH_PAGE_SIZE === 30`。

（服务层日边界对齐逻辑属 db/service 层，按仓库约定不写单测，由手工验收覆盖。）

### 6.2 手工验收清单

1. 输入「手撕鸡」（防抖后自动出结果；输入法组合中不触发）→ 高亮结果、全量统计；Esc 回到原月份普通列表。
2. 忘年份场景：命中记录分布在不同年份，日期标题带年份。
3. Ctrl+F：账单页聚焦并全选；写日记页/设置页无反应；统计 tab 无反应；弹窗打开时无反应。
4. 退出触发逐项：切统计、切页面（含从通知点击 / 托盘菜单离开后再返回）、点月份、点年份、「回到本月」、月度/年度切换、年度月份筛选、点当前已选月份、切工作区 → 均退出且浏览状态保留。
5. 清空输入自动退出；输入文字随切换被清掉。
6. 结果点开 →「复制到今天」→ 弹窗关、新记录出现在结果顶部、其余原位、滚动不动。
7. 编辑到不再含关键词 → 该条消失、从后面补一条；删除 → 消失、补位、统计减。
8. 「查看更多」：剩余数递减、按钮 loading 态、同日记录不跨批切开。
9. 分类重命名 → 结果里同类记录同步改名；删除自定义 transfer 分类 → 结果样式回退「其他」，且摘要条统计与每日小计一致（静默刷新生效）。
10. 空结果文案；搜索失败（临时构造）可重试。
11. 导出 Excel 不受搜索影响；深色主题 / 窗口缩放无样式异常。
12. `npm run test`、`npm run typecheck`、`npm run build` 全绿。

## 七、文档同步

- `docs/system/bills.md`：新增"备注搜索"章节（IPC 表 +`bills:search`、service 函数、渲染层状态、交互规则、分页与就地更新模型、Ctrl+F）。
- `CHANGELOG.md`：Unreleased「新增」一条（实现完成后写）。
- `AGENTS.md`：无稳定约定变化，不改。

## 八、实施顺序建议

1. `bills-logic.ts` 纯函数 + 单测（TDD 先行）。
2. 类型 / ipc-channels / service / IPC handler / preload / api（含服务端日对齐）。
3. `useBillsPanel` 搜索状态与函数（提交、加载更多、退出、就地更新、补位、工作区联动）。
4. `BillsPanel` UI（搜索框、摘要条、结果区、查看更多、高亮、`focusSearchInput`）。
5. `BillsRecordModal` 事件 payload；`useBillsSidebar`/`BillsSidebar` 分类变更 payload。
6. `AppShellPage` 接线（props/emits、导航退出、Ctrl+F）。
7. 手工验收 + 文档 + CHANGELOG。

## 九、留给实现者的自由度

- 搜索框具体宽度、内外边距与图标细节（沿用现有控件视觉即可）。
- 服务端日对齐的 SQL 写法（探测循环 vs 同日追加查询均可，行为由 3.4 定义）。
- 滚动容器定位与复位方式（与现有 jump 机制一致即可）。
- 文案微调（本节交互表格中的中文文案为基准语义，可在实现时润色）。

## 十、复核记录（2026-10-11）

独立 reviewer 以"照此制定计划"的视角复核后提出 3 点，均已修订进正文：

1. **统计口径恒定镜像匹配集**（3.5 / 4.4）：命中但未进入窗口的变更也计入统计；"仍匹配但移出窗口"的编辑 total 不变、只应用贡献差额；`total−1` 仅适用于删除或改到不再匹配。
2. **页面导航退出覆盖所有路径**（3.2 / 4.6）：通知点击与托盘菜单经 `navigateMainPanel` 直接改 `rightPanel`，不走 `handleActivitySelect`；改为在 `useAppShell.ts` 用 `rightPanel` 过渡 watcher 统一兜底。
3. **分类变更后的统计一致性**（3.7 / 4.5）：分类增删改会改变 `resolveCategory` 的解析口径（如删除自定义 transfer 分类后记录回退为按符号计收支），搜索态下任何分类变更都要在分类重载后静默刷新一次全量统计。

## 十一、修订记录（2026-10-11，实时搜索）

首个实现按「回车才搜」落地后，参照 VS Code 搜索体验迭代为实时搜索，正文相关小节已同步修订：

1. **输入即搜**：输入停止 300ms（防抖）自动搜索；输入法组合期间不提交中间文本，组合结束后再防抖提交。
2. **回车重定义**：跳过防抖立即搜索；失败后可回车重试；同一关键词已是当前结果时无操作（不再「重新搜索重置回第一批」）。
3. **`⏎` 提示移除**；输入清空（含纯空格）立即退出搜索。
4. **加载态改进**：新搜索保留旧结果直至响应返回，仅窗口为空时显示「正在搜索…」，避免输入过程中列表闪烁。
