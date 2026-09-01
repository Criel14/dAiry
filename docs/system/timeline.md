# dAiry 时间轴文档

## 概览

时间轴按年展示用户的人生事件（项目、旅行、学习等），由 AI 从日记中提取。支持年度全量重建和确认制单日事件记录，数据以 JSON 文件存储在工作区下。

```
时间轴面板   → 点击"重新整理本年度" → 全量重建（7天一批次、逐日判定）
自动整理     → generateDailyInsights 判定 timelineWorthy → 用户确认 → 记录单日事件
```

---

## 一、数据存储

| 文件 | 路径 | 说明 |
|------|------|------|
| 年度事件数据 | `<workspace>/timeline/<year>.json` | 按年分文件，含事件列表和生成时间戳 |

JSON 结构：

```json
{
  "year": 2026,
  "version": 2,
  "generatedAt": "2026-07-19T...",
  "events": [
    {
      "id": "evt_20260315_001",
      "date": "2026-03-15",
      "title": "完成项目文档",
      "detail": "从周二开始连续加班...",
      "diaryDates": ["2026-03-13", "2026-03-14", "2026-03-15"]
    }
  ]
}
```

---

## 二、触发场景

### 2.1 全量重建（手动）

用户从时间轴左侧面板点击"重新整理 {year} 年时间轴"（year 为侧边栏选中年份，默认当前年份）：

```
TimelineSidebar → rebuildTimeline(workspacePath, selectedYear)
  → 按 7 天一批次遍历选中年份全年日记
  → 每批 AI 逐天判定是否值得记录，值得的日期生成单事件
  → 汇总全部事件后落盘
```

**特点：**

- 目标年份由侧边栏年份选择器决定，不固定为当前年份
- 全量覆盖式重建，每次重写整个年度文件
- 逐天判定：AI 对每天独立判断是否值得记录到时间轴（宁缺毋滥），值得的日期产出一条事件，一天最多一个；id 由主进程生成（`evt_{YYYYMMDD}_001`），不由 AI 生成
- 支持取消（当前批次完成后停止，已处理的事件不保留）
- 支持进度推送（`当前批次 ~ 结束日期`，`current/total`）
- 未找到该年份任何日记时不落盘，返回 `skipped` 由前端提示，避免覆盖已有数据

> 全量重建提示词的调整（仅时间点、去时间段）留待后续版本，当前重建产出的事件在写入前统一剥离 `dateEnd` 字段，展示为时间点。

### 2.2 单日事件记录（确认制）

每次用户点击"自动整理"成功后，AI 在返回 `summary/tags/mood` 的同时返回 `timelineWorthy` 布尔值，表示当天是否有值得记录到时间轴的大事件：

- `false`（或缺省）：不弹框，不落任何时间轴数据
- `true`：前端弹确认框"检测到今天的事情比较有意义，是否记录到时间轴中？"
  - 用户取消：跳过，不落任何数据
  - 用户确认：调用 `timeline:add-day-event`，主进程提取事件（同步等待结果），落盘后提示"已记录到时间轴"

---

## 三、AI 调用细节

全量重建与单日事件提取各自使用独立的**系统 Prompt**，差异在 user prompt 的拼接内容。

### 3.1 单日事件提取模式

函数：`extractTimelineEventForDay`（`electron/main/timeline/ai.ts`），由 `addTimelineDayEvent` 调用（IPC 与 MCP 共用）。

系统 Prompt：`electron/main/ai/prompts/timeline-event-extract.system.md`（返回 `{ title, detail }`）。

**user prompt 拼接：**

| 块 | 内容 | 来源 |
|----|------|------|
| 业务日期 | `{YYYY-MM-DD}` | 当天日期 |
| 近 7 天日记全文 | `## {date}\n{body}` × 7 | 昨天往前 7 天，每篇截断约 2000 字保护 |
| 用户画像 | `user-profile-{year}.md` 正文 | 文件存在且非空才拼 |
| 补充知识 | `<workspace>/.dairy/supplement.md` 正文 | 非空才拼 |
| 当日日记 | Markdown body（不含 frontmatter） | 当天正文，为空则直接报错 |

**约束：**

- 事件必须基于当天日记原文
- 同一天已有事件时覆盖更新（保留原 id），一天最多一条
- id 由主进程生成（`evt_{YYYYMMDD}_001`），不由 AI 生成
- MCP 场景经 `dairy_record_timeline_event` 工具调用同一函数

### 3.2 全量重建模式

函数：`rebuildTimelineYear`（`electron/main/timeline/ai.ts:110`），用户点击"重新整理本年度时间轴"触发。

按 **7 天一批次**循环调用 LLM，每批次 **user prompt** 包含：

| 块 | 内容 | 来源 |
|----|------|------|
| 重建说明 | `正在重建 {year} 年时间轴，当前批次：{start} ~ {end}` | — |
| 补充知识 | `<workspace>/.dairy/supplement.md` 正文（可选） | 用户在设置页编辑 |
| 该批次日记 | `## {date}\n{body}` × 1~7 篇 | `<workspace>/journal/` 对应日期的 Markdown body |

**特点：**

- 系统 prompt 每批次重新加载，修改 prompt 文件可即时生效
- AI 逐天独立判定当天是否值得记录（值得：公司大活动、家人来访、旅行、重大决定、里程碑事件、重要聚会等；不值得：日常琐事，宁缺毋滥），值得的日期产出一条事件，一天最多一个
- AI 调用带递增超时重试：首次 `max(用户配置, 120s)`，失败后每次 +60s（120s → 180s → 240s），最多 3 次尝试；仅对超时/网络/5xx 错误重试，其余错误立即失败
- `events` 经 `normalizeBatchEvents` 归一化（主进程生成 id、按日期去重取最后一条）后以 `id` 为键合并进全年事件
- 支持取消：当前批次完成后返回 `null`，已处理事件不落盘

> 全量重建提示词的调整（仅时间点、去时间段）留待后续版本，当前重建产出的事件在写入前统一剥离 `dateEnd` 字段，展示为时间点。

### 3.3 LLM 返回值解析（全量重建）

全量重建使用 `extractJsonObject`（`electron/main/timeline/ai.ts:24`）解析，4 层容错：

| 层 | 策略 |
|----|------|
| 1 | 去掉 markdown 代码块后直接 `JSON.parse` |
| 2 | 正则提取第一个完整 JSON 对象 |
| 3 | 修复尾部逗号后重试 |
| 4 | `fixUnescapedStrings` 修复未转义换行/引号后重试 |

全部失败则抛出错误，携带前 300 字预览。单日事件提取不经过此解析（使用 `extractDayEventJson`，仅解析 `{ title, detail }`）。

**全量重建要求 LLM 返回格式：**

```json
{
  "events": [
    { "date": "2026-03-15", "title": "...", "detail": "..." }
  ]
}
```

---

## 四、合并逻辑

全量重建使用 `mergeEvents(existing, incoming)`：以 `id` 为键去重，incoming 覆盖 existing。每批 `events` 先经 `normalizeBatchEvents` 归一化（主进程生成 `evt_{YYYYMMDD}_001` id、`diaryDates` 固定为 `[date]`、按日期去重取最后一条）再合并，保证一天最多一个事件。

单日事件记录使用 `upsertEventForDate`：同一天已有事件则覆盖 `title/detail`（保留原 id），否则新增一条 id 为 `evt_{YYYYMMDD}_001` 的事件，一天最多一条。

---

## 五、前端渲染

| 组件 | 职责 |
|------|------|
| `TimelinePage.vue` | 页面壳层，无工作区时显示占位提示 |
| `TimelineSidebar.vue` | 年份选择器 + 重建按钮 + 进度/取消 |
| `TimelineView.vue` | 按月份分组渲染垂直时间轴：竖线 + 圆点标记 + 卡片 |
| `TimelineCard.vue` | 单张事件卡片：标题 + 可展开详情 + 关联日记链接 |
| `useTimeline.ts` | composable：年份选择、数据加载、重建状态管理 |

时间轴使用纯 CSS 渲染（无 SVG），竖线用 `border-left`，事件标记用 `<div>` + 圆角。当前仅支持时间点事件（无时间段），统一使用圆形标记。

---

## 六、关键函数位置

| 函数 | 文件 | 说明 |
|------|------|------|
| `extractTimelineEventForDay` | `electron/main/timeline/ai.ts:305` | 单日事件提取：拼装 prompt 调用 LLM，返回 `{ title, detail }` |
| `addTimelineDayEvent` | `electron/main/timeline/ai.ts:394` | 单日事件入口：提取 → 读取/初始化年度数据 → upsert → 写回（IPC 与 MCP 共用） |
| `extractJsonObject` | `electron/main/timeline/ai.ts:24` | 4 层容错解析 LLM 返回的 JSON（仅供全量重建使用） |
| `fixUnescapedStrings` | `electron/main/timeline/ai.ts:67` | 修复 JSON 中未转义的换行和引号（仅供全量重建使用） |
| `rebuildTimelineYear` | `electron/main/timeline/ai.ts:110` | 全量重建：7 天一批次循环调用 LLM，逐天判定 |
| `buildBatches` | `electron/main/timeline/ai.ts:93` | 按 7 天一批次分割全年日期 |
| `cancelTimelineRebuild` | `electron/main/timeline/ai.ts:253` | 取消重建 |
| `normalizeBatchEvents` | `electron/main/timeline/service.ts:95` | 批量事件归一化：主进程生成 id、`diaryDates` 固定、按日期去重取最后一条 |
| `stripLegacyDateEnd` | `electron/main/timeline/service.ts:12` | 读取/重建写入前剥离旧 `dateEnd` 字段，降级为时间点事件 |
| `readTimelineYear` | `electron/main/timeline/service.ts:17` | 从 `<workspace>/timeline/{year}.json` 读取（自动剥离 `dateEnd`） |
| `writeTimelineYear` | `electron/main/timeline/service.ts:32` | 写入 `<workspace>/timeline/{year}.json` |
| `mergeEvents` | `electron/main/timeline/service.ts:43` | 以 `id` 为键合并事件，incoming 覆盖 existing（全量重建使用） |
| `upsertEventForDate` | `electron/main/timeline/service.ts:60` | 单日事件 upsert：同一天覆盖更新，否则新增 `evt_{YYYYMMDD}_001` |
| `loadPrompt` | `electron/main/ai/prompt-loader.ts` | 加载 `timelineExtractSystem` / `timelineEventExtractSystem` 系统 prompt |
| `getRecentDailySummaries` | `electron/main/ai/journal-ai-service.ts` | 获取最近 N 天日记的 summary |
| `readSupplement` | `electron/main/ai/context.ts` | 读取 `<workspace>/.dairy/supplement.md` |

### IPC 通道

| 通道常量 | 通道值 | 方向 |
|----------|--------|------|
| `getTimeline` | `timeline:get` | renderer→main |
| `rebuildTimeline` | `timeline:rebuild` | renderer→main |
| `addTimelineDayEvent` | `timeline:add-day-event` | renderer→main |
| `cancelTimelineRebuild` | `timeline:cancel-rebuild` | renderer→main |
| `timelineRebuildProgress` | `timeline:rebuild-progress` | main→renderer |

Preload 暴露 API（`electron/preload.ts:115-138`）：
- `window.dairy.getTimeline({ workspacePath, year })`
- `window.dairy.rebuildTimeline({ workspacePath, year })` → `Promise<{ skipped: boolean }>`，`skipped` 表示该年份无日记未落盘
- `window.dairy.addTimelineDayEvent({ workspacePath, date })` → `Promise<{ recorded: boolean; reason?: 'empty'; event? }>`
- `window.dairy.cancelTimelineRebuild()`
- `window.dairy.onTimelineRebuildProgress(listener)`

---

## 七、架构约束

- **AI 不凭空生成事件**：事件必须基于日记原文
- **时间轴文件是纯粹派生数据**：时间轴维护不回写原始日记 `.md`
- **首次记录自动建文件**：单日事件记录时年度文件不存在则以空事件列表初始化，无需手动生成
- **单日事件记录**：同一天覆盖更新，一天最多一条
- **全量重建全成功才落盘**：取消则已处理事件不保留
- **目标年份由用户选择决定**：重建年份来自侧边栏选中年份，不固定为当前年份
- **无日记年份不落盘**：全年无日记时跳过写入并提示，避免清空已有数据
- **时间轴记录失败不影响日记写作**：单日事件在自动整理返回后由用户确认触发，失败仅提示，不影响已完成的整理结果
- **渲染进程不直接读写文件**：所有数据读写通过 IPC 由主进程完成
