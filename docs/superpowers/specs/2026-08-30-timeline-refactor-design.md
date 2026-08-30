# 时间轴重构设计：仅时间点 + 确认制提取

日期：2026-08-30
状态：已确认

## 背景与目标

当前时间轴存在两个问题：

1. **时间段事件（dateEnd）质量差**：AI 对时间段的起止判断不稳定，产出大量冗余或错误的时间段。
2. **日更无确认**：每次"自动整理"成功后，主进程异步调 AI 直接追加/更新事件，AI 顺手整理会产出多余内容，且增加用户等待与 token 消耗。

目标：

- 时间轴只保留**时间点**事件（某一天有大事件才记录）
- 自动整理时 AI 只返回 `timelineWorthy: true/false` 判断，不做事件提取
- `true` 时前端弹确认框，用户确认后才发起提取（同步等待结果）
- 提取输入：当天全文 + 过去 7 天全文 + 用户画像（若有）+ 补充资料（若有）
- 展示层样式不改，只不再有时间段事件
- 一键重建（rebuild）的提示词调整留到后期，本次不动
- 兼容旧数据（含 dateEnd 的旧事件自然降级为时间点）

## 一、数据模型与旧数据降级

### 1.1 类型变更（`src/types/timeline.ts`）

```ts
export interface TimelineEvent {
  id: string
  date: string
  title: string
  detail: string
  diaryDates: string[]
}
```

- `TimelineEvent` 移除 `dateEnd`
- `TimelineYearData.version` 升为 `2`
- `RebuildTimelineProgress` 不变

### 1.2 读取时显式剥离（`electron/main/timeline/service.ts`）

- `readTimelineYear()` 读取后对每个事件显式剥离 `dateEnd` 字段
- 原因：旧 JSON 运行时仍带该字段，若前端 `v-if="event.dateEnd"` 判断仍会渲染时间段样式，必须从源头剥掉
- 剥离后的旧事件自动以 `date`（开始日期）显示为时间点，即"自然降级"，无需迁移脚本

### 1.3 写盘统一时间点

- `mergeEvents()` 保持以 `id` 为键合并（去掉 dateEnd 相关逻辑）
- 所有写入路径（新增事件、覆盖更新、rebuild 落盘）都只写入无 `dateEnd` 的事件
- rebuild 产出的旧格式事件（含 dateEnd）在写入前剥离 `dateEnd`，因此即使 rebuild 提示词暂不改，产出也会降级为时间点

## 二、自动整理返回 timelineWorthy

### 2.1 提示词（`electron/main/ai/prompts/daily-organize.system.md`）

- 新增第 4 个输出字段 `timelineWorthy: boolean`
- 判断标准与示例：
  - 值得记录（true）：公司大活动、家人来访、个人娱乐活动、旅行、重大决定、里程碑事件等
  - 不值得记录（false）：吃了什么、起床晚、普通日常等琐事
- 规则：宁可保守，日常平淡日记返回 false

### 2.2 类型与解析

- `src/types/ai.ts`：`GenerateDailyInsightsResult` 增加 `timelineWorthy: boolean`
- `electron/main/ai/journal-ai-service.ts`：
  - `DailyInsightsPayload` 增加 `timelineWorthy?: unknown`
  - `normalizeDailyInsights()` 返回 `timelineWorthy: typeof payload.timelineWorthy === 'boolean' ? payload.timelineWorthy : false`
  - 缺省兜底 `false`，AI 未返回该字段时不破坏现有流程

## 三、事件提取（主进程）

### 3.1 新函数 `extractTimelineEventForDay(workspacePath, date)`（`electron/main/timeline/ai.ts`）

输入拼装（user prompt）：

| 块 | 内容 | 来源 |
|----|------|------|
| 业务日期 | `{YYYY-MM-DD}` | 当天日期 |
| 当日日记全文 | Markdown body | `<workspace>/journal/YYYY/MM/YYYY-MM-DD.md`，必须非空 |
| 近 7 天日记全文 | `## {date}\n{body}` × 7 | 昨天往前 7 天，每篇截断约 2000 字保护 token（复用/参考 `truncateEntryBody` 思路，`electron/main/profile/profile-service.ts` 的 `MAX_ENTRY_BODY_LENGTH = 2200`） |
| 用户画像 | `user-profile-{year}.md` 正文 | `readUserProfile()` 返回**非空才拼** |
| 补充资料 | `supplement.md` 正文 | `readSupplement()` 返回**非空才拼** |

新提示词文件：`electron/main/ai/prompts/timeline-event-extract.system.md`

- 返回 `{ title, detail }`
- 事件必须基于当天日记原文，不能无中生有
- 标题 4-12 字简洁有力；详情 80-200 字，结合日记原文扩展
- 不提取"今天吃了什么""起床很晚"等日常琐事
- 若当天确实无值得记录的内容，返回 `{ title: '', detail: '' }`（前端提示跳过）
- 严格 JSON 输出，不做 markdown 代码块包裹；字符串内换行必须转义

### 3.2 新 IPC `timeline:add-day-event`

- 输入：`{ workspacePath: string; date: string }`
- 流程：
  1. `extractTimelineEventForDay()` 提取 `{ title, detail }`
  2. 若 `title` 为空 → 返回 `{ recorded: false, reason: 'empty' }`（前端提示"今天没有整理出值得记录的事件，已跳过"）
  3. 读当年时间轴 JSON（不存在则以空事件列表初始化）
  4. 当天已有事件（`date` 匹配）→ **覆盖 title/detail，保留原 id**；没有 → 新增，id 由主进程生成 `evt_{YYYYMMDD}_001`（不再让 AI 造 id）
  5. `diaryDates` 设为 `[date]`
  6. 写回 JSON（version 2）
  7. 返回 `{ recorded: true, event }`
- 常量：`IPC_CHANNELS.addTimelineDayEvent: 'timeline:add-day-event'`

### 3.3 删除旧逻辑

- 删除 `extractEventsFromDay()`、`updateTimelineForDay()`
- 移除调用点：
  - `electron/main/ipc/journal.ts:66` 的 `void updateTimelineForDay(...)`
  - `electron/main/journal/write-flow.ts:147` 的 `void updateTimelineForDay(...)`
- `rebuildTimelineYear`、`cancelTimelineRebuild`、`buildBatches`、`extractJsonObject` 保留（重建功能不变，仅落盘前剥离 dateEnd）

## 四、前端确认流程

### 4.1 状态（`src/app/composables/app-shell/state.ts` 或就近）

- 新增 `isRecordingTimelineEvent: Ref<boolean>`（防重复触发；自动整理期间再次点击按钮的场景需被该状态阻断）
- 消息复用 `dailyInsightsStatusMessage`（自动整理后同一消息区域显示后续时间轴状态）

### 4.2 `handleGenerateDailyInsights`（`src/app/composables/app-shell/journal.ts`）

流程：

1. 现有自动整理逻辑不变（校验、确认覆盖、调用、回填 metadataDraft）
2. 自动整理成功且 `state.selectedDate.value === targetDate` 时：
   - 若 `result.timelineWorthy === true` → `confirmDialog('检测到今天的事情比较有意义，是否记录到时间轴中？')`
   - 取消 → 跳过（不落任何数据）
   - 确定 → 置 `isRecordingTimelineEvent = true`，`dailyInsightsStatusMessage = '正在整理时间轴事件…'` → 调 `window.dairy.addTimelineDayEvent({ workspacePath, date })`（同步等待）
     - 返回 `recorded: true` → 提示"已记录到时间轴"
     - 返回 `recorded: false, reason: 'empty'` → 提示"今天没有整理出值得记录的事件，已跳过"
     - 抛错 → 提示错误信息（沿用现有 catch 模式）
   - finally 清 `isRecordingTimelineEvent`
3. 提取期间用户切换日期 → 结果到达后检查 `state.selectedDate.value !== targetDate` 则丢弃并提示（沿用现有 targetDate 检查模式）

### 4.3 弹框

- 复用 `src/shared/dialog.ts` 的 `confirmDialog`（系统 MessageBox，走 IPC，无焦点问题）
- 文案：`检测到今天的事情比较有意义，是否记录到时间轴中？`

## 五、MCP

### 5.1 `dairy_write_entry`（`electron/main/mcp/write-tools.ts`）

- `writeJournalEntryFull` 返回值透传 `timelineWorthy: boolean`（来自 generateDailyInsights 结果）
- `WriteJournalEntryFullResult` 类型调整：`maintenance` 中移除 `timeline` 字段（或语义改为仅 profile），返回值新增 `timelineWorthy`
- 不再自动触发时间轴提取
- 工具描述更新：注明返回值含 `timelineWorthy`，供外部大模型在用户同意后调用 `dairy_record_timeline_event`

### 5.2 新增写工具 `dairy_record_timeline_event`

- 入参：`date: string`（YYYY-MM-DD）
- 工作区固定取 `lastOpenedWorkspace`（与现有写工具一致，不接收 workspacePath）
- 执行：复用 `extractTimelineEventForDay` + 写入逻辑（与 IPC 路径共用同一主进程函数）
- 返回：记录成功的事件（`{ id, date, title, detail, diaryDates }`）或错误信息（中文可读）
- 工具描述：注明"会消耗一轮 AI 调用；调用前务必与用户确认"

### 5.3 文档同步

- `AGENTS.md`：写工具"仅三个"改为"仅四个"，补充 `dairy_record_timeline_event` 描述
- `docs/system/timeline.md`：MCP 相关描述同步

## 六、展示层

### 6.1 `TimelineView.vue`

- 移除 `v-if="event.dateEnd"` 时间段分支（方形标记）与 `~ {{ event.dateEnd }}` 日期文本
- 统一渲染圆点标记 + 单日期
- 样式不动（`.timeline-event-range` class 可保留不用，避免无关样式改动）

### 6.2 其他

- `TimelineCard.vue`：不变（detail 换行处理保留）
- `TimelineSidebar.vue`：重建按钮与确认文案不动（rebuild 提示词留到后期）
- `useTimeline.ts`：不变

## 七、测试与验证

- 纯逻辑（剥离 dateEnd、事件覆盖/新增、id 生成）位于 `electron/main/timeline/service.ts` 层，可通过 `npm run dev` 手动验证
- 手动验证路径：
  1. 自动整理 → AI 返回 timelineWorthy=true → 弹框 → 确认 → 事件落盘 → 时间轴页显示圆点事件
  2. 自动整理 → 取消 → 无任何落盘
  3. 旧 JSON 含 dateEnd 事件 → 打开时间轴页显示为时间点
  4. 同一天再次确认整理 → 覆盖更新原事件
  5. MCP：`dairy_write_entry` 返回 timelineWorthy → `dairy_record_timeline_event` 记录成功
- 构建检查：`npm run build`（含 typecheck）

## 八、文档与 CHANGELOG

- `docs/system/timeline.md`：重写日更流程、数据结构（无 dateEnd）、AI 调用细节（新提示词）、IPC 列表（新增 add-day-event）
- `AGENTS.md`：MCP 写工具数量与描述、时间轴日更流程描述
- `CHANGELOG.md`：Unreleased 区新增条目

## 九、明确不做（本次范围外）

- rebuild 一键重建的提示词调整（留到后期）
- 时间轴展示样式的重新设计
- 时间段事件的任何迁移脚本
