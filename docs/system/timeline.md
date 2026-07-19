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

用户从时间轴左侧面板点击"重新整理本年度时间轴"：

```
TimelineSidebar → rebuildTimelineYear(workspacePath, year)
  → 按 3 天一批次遍历全年日记
  → 每批调用 AI 提取事件
  → 汇总全部事件后落盘
```

**特点：**

- 全量覆盖式重建，每次重写整个年度文件
- 支持取消（当前批次完成后停止，已处理的事件不保留）
- 支持进度推送（`当前批次 ~ 结束日期`，`current/total`）

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

### 3.1 extractEventsFromDay

日更和全量重建的底层共用函数。

**输入：**

| 参数 | 说明 |
|------|------|
| 当日日记正文 | 从 `.md` 文件读取 |
| 近期日记摘要 | 最近 N 天（`dailyContextDays`）的 summary |
| 已有事件列表 | 当年已提取的所有事件（id/title/date/dateEnd） |
| AI 补充知识 | `<userData>/ai-context.md`（可选） |

**输出：**

```ts
{
  newEvents: TimelineEvent[]       // 从当天日记中提取的新事件
  updatedEvents: Array<{           // 需要更新的已有事件
    id: string
    dateEnd?: string | null        // 事件已结束则设置 dateEnd
    detail?: string                // 详情更新
  }>
}
```

**系统 Prompt：** `electron/main/ai/prompts/timeline-extract.system.md`

### 3.2 rebuildTimelineYear

全量重建专用。

- 按 3 天一批次遍历全年，每批合并多天日记一起发给 AI
- 每批携带当前已提取的全部事件作为上下文
- 新事件去重后追加，跨批次事件支持更新 dateEnd

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

| 函数 | 文件 |
|------|------|
| `extractEventsFromDay` | `electron/main/timeline/ai.ts:78` |
| `rebuildTimelineYear` | `electron/main/timeline/ai.ts:174` |
| `updateTimelineForDay` | `electron/main/timeline/ai.ts:290` |
| `cancelTimelineRebuild` | `electron/main/timeline/ai.ts:284` |
| `readTimelineYear` | `electron/main/timeline/service.ts:10` |
| `writeTimelineYear` | `electron/main/timeline/service.ts:21` |
| `mergeEvents` | `electron/main/timeline/service.ts:32` |

---

## 七、架构约束

- **AI 不凭空生成事件**：事件必须基于日记原文
- **时间轴文件是纯粹派生数据**：AI 生成的日级内容不回写原始 `.md`
- **日更只追加不覆盖**：只对已有时间轴做增量更新，不创建新文件
- **全量重建全成功才落盘**：取消则已处理事件不保留
- **时间轴更新失败不影响日记写作**：日更放在 `void` 上下文，失败只打日志
- **渲染进程不直接读写文件**：所有数据读写通过 IPC 由主进程完成
