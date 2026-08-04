# dAiry 时间轴文档

## 概览

时间轴按年展示用户的人生事件（项目、旅行、学习等），由 AI 从日记中提取。支持年度全量重建和每日增量更新，数据以 JSON 文件存储在工作区下。

```
时间轴面板   → 点击"重新整理本年度" → 全量重建（3天一批次）
自动整理     → generateDailyInsights 成功后 → 日更当年时间轴
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
  "version": 1,
  "generatedAt": "2026-07-19T...",
  "events": [
    {
      "id": "evt_20260315_001",
      "date": "2026-03-15",
      "dateEnd": null,
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
  → 按 3 天一批次遍历选中年份全年日记
  → 每批调用 AI 提取事件
  → 汇总全部事件后落盘
```

**特点：**

- 目标年份由侧边栏年份选择器决定，不固定为当前年份
- 全量覆盖式重建，每次重写整个年度文件
- 支持取消（当前批次完成后停止，已处理的事件不保留）
- 支持进度推送（`当前批次 ~ 结束日期`，`current/total`）
- 未找到该年份任何日记时不落盘，返回 `skipped` 由前端提示，避免覆盖已有数据

### 2.2 日更（自动）

每次用户点击"自动整理"成功后异步触发：

```
journal.ts: generateDailyInsights 返回后
  → void updateTimelineForDay(workspacePath, date)
    → 读取当年时间轴 JSON，不存在则静默跳过
    → 调用 extractEventsFromDay()
    → 合并新事件/更新，写回 JSON
```

**特点：**

- 只在时间轴文件已存在时生效（不会凭空创建）
- 不阻塞日总结返回，失败只记 `console.error` 日志
- 不发送用户画像给 AI
- 复用 `extractEventsFromDay`，自带近期日记上下文

---

## 三、AI 调用细节

两种模式共用一套**系统 Prompt**（文件：`electron/main/ai/prompts/timeline-extract.system.md`），差异只在 **user prompt 的拼接内容**。

### 3.1 日更模式

函数：`extractEventsFromDay`（`electron/main/timeline/ai.ts:78`），每次"自动整理"成功后异步触发。

**user prompt 由 5 块拼接：**

| 块 | 内容 | 来源 |
|----|------|------|
| 业务日期 | `{YYYY-MM-DD}` | 当天日期 |
| 最近日记上下文 | `- {date}: {summary}` 列表 | 最近 `dailyContextDays`（默认 7）天日记的 `summary` frontmatter |
| 已有事件列表 | `- id/ title/ date/ dateEnd` 列表 | `<workspace>/timeline/{year}.json` 中的全部事件 |
| 补充知识 | `<userData>/ai-context.md` 正文（可选） | 用户在设置页编辑 |
| 当日日记 | Markdown body（不含 frontmatter） | `<workspace>/journal/YYYY/MM/YYYY-MM-DD.md` |

**约束：**

- 只在时间轴 JSON 文件已存在时生效，不存在则静默跳过
- `void` 上下文异步执行，不阻塞日总结返回
- 失败只记 `console.error`

### 3.2 全量重建模式

函数：`rebuildTimelineYear`（`electron/main/timeline/ai.ts:174`），用户点击"重新整理本年度时间轴"触发。

按 **3 天一批次**循环调用 LLM，每批次 **user prompt** 包含：

| 块 | 内容 | 来源 |
|----|------|------|
| 重建说明 | `正在重建 {year} 年时间轴，当前批次：{start} ~ {end}` | — |
| 当前已有事件 | `- id/ title/ date` 列表 | 前面批次已累积提取的事件 |
| 补充知识 | `<userData>/ai-context.md` 正文（可选） | 用户在设置页编辑 |
| 该批次日记 | `## {date}\n{body}` × 1~3 篇 | `<workspace>/journal/` 对应日期的 Markdown body |

**特点：**

- 系统 prompt 每批次重新加载，修改 prompt 文件可即时生效
- LLM 超时 120 秒（日更使用默认超时）
- `newEvents` 以 `id` 去重后追加，`updatedEvents` 逐条匹配更新 `dateEnd` 和 `detail`
- 支持取消：当前批次完成后返回 `null`，已处理事件不落盘

### 3.3 LLM 返回值解析

函数：`extractJsonObject`（`electron/main/timeline/ai.ts:18`），4 层容错：

| 层 | 策略 |
|----|------|
| 1 | 去掉 markdown 代码块后直接 `JSON.parse` |
| 2 | 正则提取第一个完整 JSON 对象 |
| 3 | 修复尾部逗号后重试 |
| 4 | `fixUnescapedStrings` 修复未转义换行/引号后重试 |

全部失败则抛出错误，携带前 300 字预览。

**LLM 要求返回格式：**

```json
{
  "newEvents": [{ "id": "...", "date": "...", "dateEnd": null, "title": "...", "detail": "...", "diaryDates": [...] }],
  "updatedEvents": [{ "id": "...", "dateEnd": "...", "detail": "..." }]
}
```

---

## 四、合并逻辑

`mergeEvents(existing, incoming)` 以 `id` 为键去重，incoming 覆盖 existing。

日更时先对 newEvents 做 merge，再对 updatedEvents 逐条匹配更新 dateEnd 和 detail。

---

## 五、前端渲染

| 组件 | 职责 |
|------|------|
| `TimelinePage.vue` | 页面壳层，无工作区时显示占位提示 |
| `TimelineSidebar.vue` | 年份选择器 + 重建按钮 + 进度/取消 |
| `TimelineView.vue` | 按月份分组渲染垂直时间轴：竖线 + 圆点/方形标记 + 卡片 |
| `TimelineCard.vue` | 单张事件卡片：标题 + 可展开详情 + 关联日记链接 |
| `useTimeline.ts` | composable：年份选择、数据加载、重建状态管理 |

时间轴使用纯 CSS 渲染（无 SVG），竖线用 `border-left`，事件标记用 `<div>` + 圆角。单日事件为圆形标记，跨日事件为圆角方形标记，两者同尺寸同中心线对齐。

---

## 六、关键函数位置

| 函数 | 文件 | 说明 |
|------|------|------|
| `extractEventsFromDay` | `electron/main/timeline/ai.ts:78` | 日更/重建底层：拼装 prompt 调用 LLM |
| `extractJsonObject` | `electron/main/timeline/ai.ts:18` | 4 层容错解析 LLM 返回的 JSON |
| `fixUnescapedStrings` | `electron/main/timeline/ai.ts:61` | 修复 JSON 中未转义的换行和引号 |
| `rebuildTimelineYear` | `electron/main/timeline/ai.ts:174` | 全量重建：3 天一批次循环调用 LLM |
| `buildBatches` | `electron/main/timeline/ai.ts:157` | 按 3 天一批次分割全年日期 |
| `cancelTimelineRebuild` | `electron/main/timeline/ai.ts:284` | 取消重建 |
| `updateTimelineForDay` | `electron/main/timeline/ai.ts:290` | 日更入口：读取现有数据 → AI 提取 → 合并写回 |
| `readTimelineYear` | `electron/main/timeline/service.ts:10` | 从 `<workspace>/timeline/{year}.json` 读取 |
| `writeTimelineYear` | `electron/main/timeline/service.ts:21` | 写入 `<workspace>/timeline/{year}.json` |
| `mergeEvents` | `electron/main/timeline/service.ts:32` | 以 `id` 为键合并事件，incoming 覆盖 existing |
| `loadPrompt` | `electron/main/ai/prompt-loader.ts` | 加载 `timelineExtractSystem` 系统 prompt |
| `getRecentDailySummaries` | `electron/main/ai/journal-ai-service.ts` | 获取最近 N 天日记的 summary |
| `readAiContext` | `electron/main/ai/context.ts` | 读取 `<userData>/ai-context.md` |

### IPC 通道

| 通道常量 | 通道值 | 方向 |
|----------|--------|------|
| `getTimeline` | `timeline:get` | renderer→main |
| `rebuildTimeline` | `timeline:rebuild` | renderer→main |
| `cancelTimelineRebuild` | `timeline:cancel-rebuild` | renderer→main |
| `timelineRebuildProgress` | `timeline:rebuild-progress` | main→renderer |

Preload 暴露 API（`electron/preload.ts:109-131`）：
- `window.dairy.getTimeline({ workspacePath, year })`
- `window.dairy.rebuildTimeline({ workspacePath, year })` → `Promise<{ skipped: boolean }>`，`skipped` 表示该年份无日记未落盘
- `window.dairy.cancelTimelineRebuild()`
- `window.dairy.onTimelineRebuildProgress(listener)`

---

## 七、架构约束

- **AI 不凭空生成事件**：事件必须基于日记原文
- **时间轴文件是纯粹派生数据**：AI 生成的日级内容不回写原始 `.md`
- **日更只追加不覆盖**：只对已有时间轴做增量更新，不创建新文件
- **全量重建全成功才落盘**：取消则已处理事件不保留
- **目标年份由用户选择决定**：重建年份来自侧边栏选中年份，不固定为当前年份
- **无日记年份不落盘**：全年无日记时跳过写入并提示，避免清空已有数据
- **时间轴更新失败不影响日记写作**：日更放在 `void` 上下文，失败只打日志
- **渲染进程不直接读写文件**：所有数据读写通过 IPC 由主进程完成
