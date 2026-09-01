# 时间线手动增删改设计：弹窗表单

日期：2026-09-01
状态：已确认

## 背景与目标

时间线事件目前只能由 AI 产生（自动整理确认制单日事件、批量整理全量重建），用户无法手动修正或补充：不能新增错过的纪念日、不能修改 AI 生成的标题/详情、不能删除误判的事件。

目标：为时间线事件提供**手动增删改**能力，交互采用弹窗表单（仿记账 `BillsRecordModal` 范式），保持"同一天最多一个事件"的全局约束。

## 一、交互设计

### 1.1 入口位置

- **新增**：时间线页（`TimelinePage.vue`）头部标题右侧「添加事件」按钮（header 已为 `space-between` 布局，右侧空位正好使用）；无工作区时禁用
- **编辑**：卡片展开区底部「编辑」按钮 → 弹窗表单回填 → 保存
- **删除**：卡片展开区底部「删除」按钮 → 主进程原生确认框（`confirmDialog`，文案"确定删除这条时间线事件吗？"）→ 删除并刷新
- **跳转日记**：保留现有卡片内日记日期链接（`diaryDates` 自动等于 `[date]`，编辑改日期时同步更新，跳转行为不变）

### 1.2 表单字段

| 字段 | 控件 | 说明 |
|------|------|------|
| 日期 | `input[type=date]` | 必填，格式 YYYY-MM-DD |
| 标题 | 文本框 | 必填，非空，最大 50 字 |
| 详情 | 多行文本框 | 选填，换行以 `\n` 存储，最大 500 字 |

`diaryDates` 由日期派生（`[date]`），表单不设独立关联字段。

### 1.3 冲突规则（同一天最多一个事件）

- 新增：目标日期已有事件 → 弹窗内红字报错"当天已有事件，请换个日期"，不落盘
- 编辑改日期：新日期已有**其他**事件（排除自身）→ 同样报错；不改日期或新日期无冲突则正常保存
- 冲突校验在主进程完成（单例事实源），前端也做乐观校验（可选）

## 二、分层改动

### 2.1 纯逻辑（`electron/main/timeline/service.ts`，TDD）

新增三个纯函数，均不涉及文件 IO，可单测：

```ts
export function addManualEvent(
  events: TimelineEvent[],
  draft: { date: string; title: string; detail: string },
): { ok: true; events: TimelineEvent[]; event: TimelineEvent } | { ok: false; reason: 'conflict' }
```

- 同日期冲突 → `{ ok: false, reason: 'conflict' }`
- 无冲突 → 新增事件，id 主进程生成 `evt_{YYYYMMDD}_001`，`diaryDates: [date]`，返回新数组（不可变）

```ts
export function updateTimelineEvent(
  events: TimelineEvent[],
  input: { id: string; date: string; title: string; detail: string },
): { ok: true; events: TimelineEvent[]; event: TimelineEvent } | { ok: false; reason: 'not-found' | 'conflict' }
```

- id 不存在 → `not-found`
- 改日期后与其他事件冲突（排除自身）→ `conflict`
- 成功 → 更新 title/detail/date/diaryDates（diaryDates 同步为新日期）

```ts
export function removeTimelineEvent(
  events: TimelineEvent[],
  id: string,
): { ok: true; events: TimelineEvent[] } | { ok: false; reason: 'not-found' }
```

### 2.2 主进程 IPC（`electron/main/ipc/timeline.ts`）

新增三个 handler，复用 `workspacePathOrThrow` 与 `readTimelineYear`/`writeTimelineYear`：

| 通道 | 输入 | 行为 |
|------|------|------|
| `timeline:create-event` | `{ workspacePath, date, title, detail }` | 读取当年数据（无则空数组初始化）→ `addManualEvent` → 冲突报错 / 写回 version 2 |
| `timeline:update-event` | `{ workspacePath, id, date, title, detail }` | 读取 → `updateTimelineEvent` → 写回 |
| `timeline:delete-event` | `{ workspacePath, id }` | 读取 → `removeTimelineEvent` → 写回 |

year 由 date 派生（`Number.parseInt(date.split('-')[0])`）。失败原因映射为可读中文错误信息。

### 2.3 类型与 preload

- `src/types/timeline.ts`：新增 `CreateTimelineEventInput`、`UpdateTimelineEventInput`、`DeleteTimelineEventInput`
- `src/shared/ipc-channels.ts`：timeline 区块 +3 通道
- `electron/preload.ts`：`createTimelineEvent` / `updateTimelineEvent` / `deleteTimelineEvent`
- `src/types/api.ts`：DairyApi 对应方法

### 2.4 前端

- 新组件 `src/components/timeline/components/TimelineEventModal/`（TimelineEventModal.vue + .css，仿 `BillsRecordModal`：modal-overlay/modal-card/form-row/modal-footer，样式走主题 token）
- `TimelinePage.vue`：头部右侧「添加事件」按钮（`v-if="workspacePath"`），弹窗挂载
- `TimelineCard.vue`：展开区底部加「编辑 / 删除」按钮（`@click.stop`，避免触发展开/收起）
- `useTimeline.ts`：
  - 新增 `modalState`（`open` + `editing: TimelineEvent | null`）
  - `openCreateModal` / `openEditModal(event)` / `closeEventModal`
  - `handleSaveEvent(input)`：新增或更新 → `window.dairy.*` → 成功后 `loadTimeline(selectedYear)` + 关闭弹窗 + 失败弹窗内红字
  - `handleDeleteEvent(event)`：`confirmDialog` 确认 → `window.dairy.deleteTimelineEvent` → 刷新

## 三、测试

`tests/timeline/service.test.ts` 新增用例：

- `addManualEvent`：无冲突新增（id 格式、diaryDates）、冲突拒绝（返回 reason conflict、原数组不变）、不可变性
- `updateTimelineEvent`：更新字段成功、diaryDates 随日期更新、改日期冲突拒绝（排除自身）、id 不存在返回 not-found
- `removeTimelineEvent`：删除成功、id 不存在 not-found、不可变性

## 四、文档同步

- `docs/system/timeline.md`：触发场景新增"手动增删改"小节；IPC 通道表 +3；关键函数表 +3
- `CHANGELOG.md`：Unreleased 新增条目"时间线事件支持手动新增、编辑与删除（弹窗表单，同一天最多一个事件）"
- `AGENTS.md`：无约束变化，不改

## 五、验证

- `npm run test` 全部 PASS
- `npm run typecheck` 无错误
- `npm run build` 成功
- 手动验证：
  1. 时间轴页点「添加事件」→ 填日期/标题/详情 → 保存 → 卡片出现，跳转日记可用
  2. 新增冲突日期 → 红字报错不落盘
  3. 展开卡片 → 编辑 → 改标题/详情/日期 → 保存后刷新，改日期后 diaryDates 更新
  4. 编辑改到已有事件日期 → 报错
  5. 删除 → 确认框 → 事件消失
  6. 无工作区时按钮禁用

## 六、明确不做（本次范围外）

- MCP 手动 CRUD 工具
- 一天多条事件的放宽
- 卡片内联编辑
- 时间轴展示样式改动
