# 人生时间轴（Life Timeline）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 dAiry 新增「人生时间轴」面板，AI 自动从日记中提取事件，以垂直时间轴呈现。

**Architecture:** 数据层（主进程 AI 扫描 → JSON 落盘） → IPC 桥接 → 视图层（左侧年份选择器 + 右侧垂直时间轴）。YearPicker 从 ReportsSidebar 抽取为共享组件。

**Tech Stack:** Electron + Vue 3 + TypeScript, dayjs, lucide-vue-next

---

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `src/types/timeline.ts` | 时间轴类型定义 |
| Modify | `src/types/index.ts` | 导出新类型 |
| Modify | `src/types/ui.ts` | RightPanel 新增 `'timeline'` |
| Modify | `src/types/api.ts` | DairyApi 新增 timeline 方法 |
| Modify | `src/shared/ipc-channels.ts` | 新增 timeline IPC 通道 |
| Create | `electron/main/timeline/service.ts` | JSON 读写 + 扫描协调 |
| Create | `electron/main/timeline/ai.ts` | AI 事件提取 |
| Create | `electron/main/ai/prompts/timeline-extract.system.md` | 提取 prompt |
| Create | `electron/main/ipc/timeline.ts` | IPC handler 注册 |
| Modify | `electron/main/ipc/index.ts` | 注册 timeline handler |
| Modify | `electron/preload.ts` | 暴露 timeline API |
| Modify | `src/shared/theme/tokens/content.css` | 新增 8 个事件颜色 token |
| Modify | `src/shared/theme/tokens/dark.css` | 深色模式事件颜色 |
| Create | `src/components/shared/YearPickerGrid.vue` | 从 ReportsSidebar 抽取的年份选择器 |
| Modify | `src/components/report/components/ReportsSidebar/ReportsSidebar.vue` | 改用共享 YearPickerGrid |
| Create | `src/components/timeline/TimelinePage.vue` | 时间轴页面总控 |
| Create | `src/components/timeline/TimelinePage.css` | 页面样式 |
| Create | `src/components/timeline/TimelineSidebar.vue` | 左侧面板 |
| Create | `src/components/timeline/TimelineSidebar.css` | 左侧面板样式 |
| Create | `src/components/timeline/TimelineView.vue` | 右侧时间轴视图 |
| Create | `src/components/timeline/TimelineView.css` | 时间轴样式 |
| Create | `src/components/timeline/TimelineCard.vue` | 事件卡片 |
| Create | `src/components/timeline/TimelineCard.css` | 卡片样式 |
| Modify | `src/components/workspace/components/WorkspaceSidebar/WorkspaceSidebar.vue` | 3按钮→2×2网格，新增时间轴 |
| Modify | `src/components/workspace/components/WorkspaceSidebar/WorkspaceSidebar.css` | 网格样式 |
| Modify | `src/app/pages/AppShellPage.vue` | 集成时间轴面板 |
| Modify | `src/app/composables/useAppShell.ts` | 新增 openTimelinePage + timeline composable |
| Create | `src/components/timeline/composables/useTimeline.ts` | 时间轴逻辑 composable |

---

### Task 1: 类型定义

**Files:**
- Create: `src/types/timeline.ts`
- Modify: `src/types/index.ts`
- Modify: `src/types/ui.ts`

- [ ] **Step 1: 创建时间轴类型文件**

在 `src/types/timeline.ts` 中：

```typescript
export interface TimelineEvent {
  id: string
  date: string
  dateEnd: string | null
  title: string
  summary: string
  detail: string
  diaryDates: string[]
}

export interface TimelineYearData {
  year: number
  version: number
  generatedAt: string
  events: TimelineEvent[]
}

export interface RebuildTimelineProgress {
  weekLabel: string
  current: number
  total: number
}
```

- [ ] **Step 2: 修改 `src/types/index.ts`，追加导出**

```typescript
export * from './timeline'
```

- [ ] **Step 3: 修改 `src/types/ui.ts`，RightPanel 增加 `'timeline'`**

```typescript
export type RightPanel = 'journal' | 'reports' | 'settings' | 'timeline'
```

- [ ] **Step 4: 验证 TypeScript 编译**

```powershell
npx vue-tsc --noEmit src/types/timeline.ts src/types/index.ts src/types/ui.ts
```

Expected: 无新增类型错误。

---

### Task 2: IPC 通道与 API 接口

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 1: 新增 IPC 通道**

在 `src/shared/ipc-channels.ts` 的 `IPC_CHANNELS` 对象末尾追加：

```typescript
// timeline
getTimeline: 'timeline:get',
rebuildTimeline: 'timeline:rebuild',
cancelTimelineRebuild: 'timeline:cancel-rebuild',
timelineRebuildProgress: 'timeline:rebuild-progress',
```

- [ ] **Step 2: 新增 API 接口方法**

在 `src/types/api.ts` 的 import 区追加：

```typescript
import type { TimelineYearData, RebuildTimelineProgress } from './timeline'
```

在 `DairyApi` 接口中追加：

```typescript
getTimeline: (year: number) => Promise<TimelineYearData | null>
rebuildTimeline: (workspacePath: string) => Promise<void>
cancelTimelineRebuild: () => Promise<void>
onTimelineRebuildProgress: (listener: (progress: RebuildTimelineProgress) => void) => () => void
```

- [ ] **Step 3: 验证编译**

```powershell
npx vue-tsc --noEmit
```

Expected: 无新增类型错误。

---

### Task 3: 主进程 — 时间轴服务

**Files:**
- Create: `electron/main/timeline/service.ts`

- [ ] **Step 1: 创建服务文件**

`electron/main/timeline/service.ts`：

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TimelineEvent, TimelineYearData } from '../../../src/types/timeline'
import { resolveTimelineDirPath } from '../workspace/paths'

export function getTimelineFilePath(workspacePath: string, year: number): string {
  return join(resolveTimelineDirPath(workspacePath), `${year}.json`)
}

export function readTimelineYear(workspacePath: string, year: number): TimelineYearData | null {
  const filePath = getTimelineFilePath(workspacePath, year)

  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as TimelineYearData
}

export function writeTimelineYear(workspacePath: string, data: TimelineYearData): void {
  const dirPath = resolveTimelineDirPath(workspacePath)

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }

  const filePath = getTimelineFilePath(workspacePath, data.year)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function mergeEvents(existing: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
  const eventMap = new Map<string, TimelineEvent>()

  for (const event of existing) {
    eventMap.set(event.id, event)
  }

  for (const event of incoming) {
    eventMap.set(event.id, event)
  }

  return Array.from(eventMap.values())
}
```

- [ ] **Step 2: 在 `electron/main/workspace/paths.ts` 中新增 timeline 路径函数**

读取 `electron/main/workspace/paths.ts` 找到类似函数的模式，追加：

```typescript
export function resolveTimelineDirPath(workspacePath: string): string {
  return path.join(workspacePath, 'timeline')
}
```

---

### Task 4: 主进程 — 工作区路径函数

**Files:**
- Modify: `electron/main/workspace/paths.ts`

- [ ] **Step 1: 读取现有 paths.ts 确认格式**

```powershell
Get-Content "electron\main\workspace\paths.ts" -Head 30
```

- [ ] **Step 2: 在文件末尾追加 timeline 路径函数**

```typescript
export function resolveTimelineDirPath(workspacePath: string): string {
  return path.join(workspacePath, 'timeline')
}
```

---

### Task 5: 主进程 — AI 事件提取

**Files:**
- Create: `electron/main/ai/prompts/timeline-extract.system.md`
- Modify: `electron/main/ai/prompt-loader.ts`
- Create: `electron/main/timeline/ai.ts`

- [ ] **Step 1: 创建 system prompt**

`electron/main/ai/prompts/timeline-extract.system.md`：

```markdown
你是一个人生时间轴分析助手。你的任务是根据用户的日记，提取出有意义的人生事件。

## 提取规则

1. 事件必须基于日记原文，不能无中生有
2. 事件不限于重大事件，平凡日常中持续的事项也值得记录。目标：让用户能直观看出每个阶段主要在做什么
3. 标题 4-12 字，简洁有力
4. 摘要 20-40 字，说明事件本质
5. 详情 80-200 字，结合日记原文扩展
6. dateEnd：有明确结束日期的时间段才填，持续中或不确定的填 null
7. 如果提供的日记中无新事件，返回空数组
8. 仔细分析上下文日记，判断是否已有事件在延续或已结束，更新对应事件的 dateEnd 和 detail
9. 不要提取类似"今天吃了什么""今天起床很晚"等无意义的日常琐事

## 输出格式

必须返回严格的 JSON，不要包含 markdown 标记：

```json
{
  "newEvents": [
    {
      "id": "evt_YYYYMMDD_序号",
      "date": "YYYY-MM-DD",
      "dateEnd": null,
      "title": "事件标题",
      "summary": "一句话摘要",
      "detail": "详细描述",
      "diaryDates": ["YYYY-MM-DD"]
    }
  ],
  "updatedEvents": [
    {
      "id": "已有事件ID",
      "dateEnd": "更新后的结束日期",
      "detail": "更新后的完整描述"
    }
  ]
}
```
```

- [ ] **Step 2: 在 prompt-loader.ts 中注册新 prompt**

在 `PROMPT_FILE_MAP` 中追加：

```typescript
timelineExtractSystem: new URL('./prompts/timeline-extract.system.md', import.meta.url),
```

- [ ] **Step 3: 创建 AI 服务文件**

`electron/main/timeline/ai.ts`：

```typescript
import dayjs from 'dayjs'
import type { TimelineEvent, TimelineYearData } from '../../../src/types/timeline'
import type { RecentDaySummary } from '../../../src/types/ai'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { readAppConfig, normalizeAiSettings } from '../app-config'
import { readAiContext } from '../ai/context'
import { readAiApiKey } from '../secrets'
import { createAiChatClient } from '../ai/provider-factory'
import { loadPrompt } from '../ai/prompt-loader'
import { readJournalDocument } from '../journal/document'
import { getRecentDailySummaries } from '../ai/journal-ai-service'

interface ExtractResult {
  newEvents: TimelineEvent[]
  updatedEvents: Array<{ id: string; dateEnd?: string | null; detail?: string }>
}

function extractJsonObject(text: string): ExtractResult {
  const trimmedText = text.trim()

  try {
    return JSON.parse(trimmedText) as ExtractResult
  } catch {
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('大模型返回内容不是有效的结构化结果。')
    }
    return JSON.parse(jsonMatch[0]) as ExtractResult
  }
}

export async function extractEventsFromDay(
  workspacePath: string,
  date: string,
  existingEvents: TimelineEvent[],
): Promise<ExtractResult> {
  assertValidDate(date)

  const [config, systemPrompt, aiContext] = await Promise.all([
    readAppConfig(),
    loadPrompt('timelineExtractSystem'),
    readAiContext(),
  ])

  const settings = normalizeAiSettings(config.ai)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  const { frontmatter, body } = await readJournalDocument(
    resolveJournalEntryFilePath(workspacePath, date),
  )

  if (!body.trim()) {
    return { newEvents: [], updatedEvents: [] }
  }

  const recentSummaries = await getRecentDailySummaries(
    workspacePath,
    date,
    settings.dailyContextDays,
  )

  const existingEventsBlock =
    existingEvents.length > 0
      ? '已有事件列表：\n' +
        existingEvents
          .map(
            (e) =>
              `- id: ${e.id}, title: ${e.title}, date: ${e.date}, dateEnd: ${e.dateEnd ?? '进行中'}`,
          )
          .join('\n')
      : '暂无已有事件'

  const contextBlock =
    recentSummaries.length > 0
      ? '最近日记上下文：\n' +
        recentSummaries.map((s) => `- ${s.date}: ${s.summary || '无摘要'}`).join('\n')
      : ''

  const userPrompt = [
    `业务日期：${date}`,
    contextBlock,
    existingEventsBlock,
    aiContext.trim() ? `补充知识：\n${aiContext.trim()}` : '',
    '当日日记：',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')

  const client = createAiChatClient(settings, apiKey)
  const responseText = await client.completeJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const result = extractJsonObject(responseText)
  return {
    newEvents: Array.isArray(result.newEvents) ? result.newEvents : [],
    updatedEvents: Array.isArray(result.updatedEvents) ? result.updatedEvents : [],
  }
}

export async function rebuildTimelineYear(
  workspacePath: string,
  year: number,
  onProgress: (progress: { weekLabel: string; current: number; total: number }) => void,
): Promise<TimelineEvent[] | null> {
  const allEvents: TimelineEvent[] = []
  const start = dayjs(`${year}-01-01`)
  const end = dayjs(`${year}-12-31`)
  const weeks: Array<{ start: string; end: string }> = []
  let cursor = start

  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const weekStart = cursor.format('YYYY-MM-DD')
    const weekEnd = cursor.add(6, 'day')
    weeks.push({
      start: weekStart,
      end: weekEnd.isAfter(end) ? end.format('YYYY-MM-DD') : weekEnd.format('YYYY-MM-DD'),
    })
    cursor = weekEnd.add(1, 'day')
  }

  let cancelled = false
  const cancelToken = { cancelled }
  ;(globalThis as Record<string, unknown>).__timelineCancelTokens =
    (globalThis as Record<string, unknown>).__timelineCancelTokens || {}
  ;(globalThis as Record<string, unknown>).__timelineCancelTokens[year] = cancelToken

  for (let i = 0; i < weeks.length; i++) {
    const { start: weekStart, end: weekEnd } = weeks[i]
    onProgress({ weekLabel: `${weekStart} ~ ${weekEnd}`, current: i + 1, total: weeks.length })

    if (cancelToken.cancelled) {
      return null
    }

    const [config, systemPrompt] = await Promise.all([
      readAppConfig(),
      loadPrompt('timelineExtractSystem'),
    ])

    const settings = normalizeAiSettings(config.ai)
    const apiKey = await readAiApiKey(settings.providerType)

    if (!apiKey) {
      throw new Error('请先在设置页保存当前 provider 的 API Key。')
    }

    const aiContext = await readAiContext()

    const bodies: string[] = []
    const cursor = dayjs(weekStart)
    while (cursor.isBefore(dayjs(weekEnd)) || cursor.isSame(dayjs(weekEnd), 'day')) {
      const dayStr = cursor.format('YYYY-MM-DD')

      try {
        const { body } = await readJournalDocument(
          resolveJournalEntryFilePath(workspacePath, dayStr),
        )
        if (body.trim()) {
          bodies.push(`## ${dayStr}\n${body}`)
        }
      } catch {
        // 当天没有日记，跳过
      }

      cursor = cursor.add(1, 'day')
    }

    if (bodies.length === 0) {
      continue
    }

    const existingEventsBlock =
      allEvents.length > 0
        ? '当前已有事件：\n' +
          allEvents
            .map((e) => `- id: ${e.id}, title: ${e.title}, date: ${e.date}`)
            .join('\n')
        : ''

    const userPrompt = [
      `正在重建 ${year} 年时间轴，当前批次：${weekStart} ~ ${weekEnd}`,
      existingEventsBlock,
      aiContext.trim() ? `补充知识：\n${aiContext.trim()}` : '',
      ...bodies,
    ]
      .filter(Boolean)
      .join('\n\n')

    const client = createAiChatClient(settings, apiKey)
    const responseText = await client.completeJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const result = extractJsonObject(responseText)

    for (const event of result.newEvents) {
      allEvents.push(event)
    }

    for (const update of result.updatedEvents) {
      const idx = allEvents.findIndex((e) => e.id === update.id)
      if (idx !== -1) {
        if (update.dateEnd !== undefined) allEvents[idx].dateEnd = update.dateEnd
        if (update.detail !== undefined) allEvents[idx].detail = update.detail
      }
    }
  }

  delete (globalThis as Record<string, unknown>).__timelineCancelTokens[year]
  return allEvents
}

export function cancelTimelineRebuild(year: number): void {
  const tokens = (globalThis as Record<string, unknown>).__timelineCancelTokens as
    | Record<number, { cancelled: boolean }>
    | undefined
  if (tokens?.[year]) {
    tokens[year].cancelled = true
  }
}
```

- [ ] **Step 4: 验证编译**

```powershell
npx vue-tsc --noEmit
```

---

### Task 6: 主进程 — IPC Handler

**Files:**
- Create: `electron/main/ipc/timeline.ts`
- Modify: `electron/main/ipc/index.ts`

- [ ] **Step 1: 创建 IPC handler 文件**

`electron/main/ipc/timeline.ts`：

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../constants'
import type { TimelineYearData } from '../../../src/types/timeline'
import { readTimelineYear, writeTimelineYear } from '../timeline/service'
import { rebuildTimelineYear, cancelTimelineRebuild } from '../timeline/ai'

export function registerTimelineIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getTimeline, (_event, year: number) => {
    const workspacePath = readWorkspaceFromEvent(_event)
    if (!workspacePath) return null
    return readTimelineYear(workspacePath, year)
  })

  ipcMain.handle(IPC_CHANNELS.rebuildTimeline, async (_event, workspacePath: string) => {
    const now = new Date()
    const year = now.getFullYear()
    const senderWindow = BrowserWindow.fromWebContents(_event.sender)

    const events = await rebuildTimelineYear(workspacePath, year, (progress) => {
      if (senderWindow && !senderWindow.isDestroyed()) {
        senderWindow.webContents.send(IPC_CHANNELS.timelineRebuildProgress, progress)
      }
    })

    if (events === null) {
      return
    }

    const data: TimelineYearData = {
      year,
      version: 1,
      generatedAt: new Date().toISOString(),
      events,
    }

    writeTimelineYear(workspacePath, data)
  })

  ipcMain.handle(IPC_CHANNELS.cancelTimelineRebuild, () => {
    const now = new Date()
    cancelTimelineRebuild(now.getFullYear())
  })
}

function readWorkspaceFromEvent(event: Electron.IpcMainInvokeEvent): string | null {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow) return null

  const config = (senderWindow as Record<string, unknown>).__workspacePath as string | undefined
  return config ?? null
}
```

- [ ] **Step 2: 修改 IPC index**

在 `electron/main/ipc/index.ts` 中：

```typescript
import { registerTimelineIpcHandlers } from './timeline'

// 在 registerIpcHandlers() 函数体中追加
registerTimelineIpcHandlers()
```

---

**Note:** 工作区路径传递方式需要在后续调整——主窗口需要 set 工作区路径给 IPC 上下文。让我们在 Task 7 调整 App 的 IPC handler 来记录当前工作区。

### Task 7: 主进程 — 工作区路径上下文

**Files:**
- Modify: `electron/main/ipc/timeline.ts`

- [ ] **Step 1: 改用更简单的方案**

由于 electron 的 BrowserWindow 可以存自定义属性，在 `electron/main/ipc/timeline.ts` 中简化 workspace 获取。参考现有的 workspace IPC handler 中如何获取 workspace path，或者改用从 sender 获取的方式。

实际方案：在 `getTimeline` 调用时传入 `workspacePath` 参数（从渲染进程获取）。

修改 `electron/main/ipc/timeline.ts`：

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../constants'
import type { TimelineYearData } from '../../../src/types/timeline'
import { readTimelineYear, writeTimelineYear } from '../timeline/service'
import { rebuildTimelineYear, cancelTimelineRebuild } from '../timeline/ai'

export function registerTimelineIpcHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.getTimeline,
    (_event, input: { workspacePath: string; year: number }) => {
      return readTimelineYear(input.workspacePath, input.year)
    },
  )

  ipcMain.handle(IPC_CHANNELS.rebuildTimeline, async (event, workspacePath: string) => {
    const now = new Date()
    const year = now.getFullYear()

    const events = await rebuildTimelineYear(workspacePath, year, (progress) => {
      event.sender.send(IPC_CHANNELS.timelineRebuildProgress, progress)
    })

    if (events === null) {
      return
    }

    const data: TimelineYearData = {
      year,
      version: 1,
      generatedAt: new Date().toISOString(),
      events,
    }

    writeTimelineYear(workspacePath, data)
  })

  ipcMain.handle(IPC_CHANNELS.cancelTimelineRebuild, () => {
    const now = new Date()
    cancelTimelineRebuild(now.getFullYear())
  })
}
```

---

### Task 8: Preload API

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: 在 preload.ts 中追加 timeline API**

在 `electron/preload.ts` 的 `dairyApi` 对象中追加：

```typescript
getTimeline: (input) => ipcRenderer.invoke(IPC_CHANNELS.getTimeline, input),
rebuildTimeline: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.rebuildTimeline, workspacePath),
cancelTimelineRebuild: () => ipcRenderer.invoke(IPC_CHANNELS.cancelTimelineRebuild),
onTimelineRebuildProgress: (listener) => {
  const wrappedListener = (
    _event: Electron.IpcRendererEvent,
    payload: { weekLabel?: unknown; current?: unknown; total?: unknown } | undefined,
  ) => {
    if (
      typeof payload?.weekLabel === 'string' &&
      typeof payload?.current === 'number' &&
      typeof payload?.total === 'number'
    ) {
      listener({ weekLabel: payload.weekLabel, current: payload.current, total: payload.total })
    }
  }

  ipcRenderer.on(IPC_CHANNELS.timelineRebuildProgress, wrappedListener)

  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.timelineRebuildProgress, wrappedListener)
  }
},
```

需要在 `DairyApi` 接口中修改 `getTimeline` 的签名为接受 `input` 对象。回到 Task 2 修改：

在 `src/types/api.ts` 中：

```typescript
getTimeline: (input: { workspacePath: string; year: number }) => Promise<TimelineYearData | null>
```

---

### Task 9: 主题 — 事件颜色 Token

**Files:**
- Modify: `src/shared/theme/tokens/content.css`
- Modify: `src/shared/theme/tokens/dark.css`

- [ ] **Step 1: 在 content.css 末尾追加事件颜色**

```css
--color-timeline-event-1: #A8C5D6;
--color-timeline-event-2: #B8D0A8;
--color-timeline-event-3: #D6C5A8;
--color-timeline-event-4: #D6A8C1;
--color-timeline-event-5: #A8D4D6;
--color-timeline-event-6: #C5A8D6;
--color-timeline-event-7: #D6D0A8;
--color-timeline-event-8: #A8B5D6;
```

- [ ] **Step 2: 在 dark.css 末尾追加深色模式事件颜色**

```css
--color-timeline-event-1: #5A788A;
--color-timeline-event-2: #6B8A5A;
--color-timeline-event-3: #8A7A5A;
--color-timeline-event-4: #8A5A74;
--color-timeline-event-5: #5A888A;
--color-timeline-event-6: #785A8A;
--color-timeline-event-7: #8A875A;
--color-timeline-event-8: #6A6A8A;
```

---

### Task 10: 从 ReportsSidebar 抽取 YearPickerGrid 共享组件

**Files:**
- Create: `src/components/shared/YearPickerGrid.vue`
- Modify: `src/components/report/components/ReportsSidebar/ReportsSidebar.vue`

- [ ] **Step 1: 读取 ReportsSidebar 中年份选择器的代码**

读取 `src/components/report/components/ReportsSidebar/ReportsSidebar.vue` 中 `preset === 'year'` 分支（约第 112-143 行）。

- [ ] **Step 2: 创建共享组件 YearPickerGrid.vue**

`src/components/shared/YearPickerGrid.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{
  selectedYear: number
  hasDataYears?: Set<string>
}>()

const emit = defineEmits<{
  'update:selectedYear': [year: number]
}>()

const yearPickerPage = ref(Math.floor(dayjs().year() / 12) * 12)

const yearPickerStart = computed(() => yearPickerPage.value)

const yearPickerTitle = computed(
  () => `${yearPickerStart.value} - ${yearPickerStart.value + 11}`,
)

const yearCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const year = yearPickerStart.value + index
    const key = `${year}`
    return {
      key,
      label: `${year} 年`,
      isSelected: year === props.selectedYear,
      isCurrent: year === dayjs().year(),
      hasData: props.hasDataYears?.has(key) ?? false,
    }
  }),
)

function selectYear(key: string) {
  emit('update:selectedYear', Number.parseInt(key, 10))
}

function shiftYearPage(delta: number) {
  yearPickerPage.value += delta * 12
}

function goToCurrentYear() {
  emit('update:selectedYear', dayjs().year())
}
</script>

<template>
  <section class="selector-card">
    <header class="selector-toolbar">
      <button class="toolbar-button" @click="shiftYearPage(-1)">
        <ChevronsLeft class="toolbar-icon" />
      </button>
      <strong class="selector-title">{{ yearPickerTitle }}</strong>
      <button class="toolbar-button" @click="shiftYearPage(1)">
        <ChevronsRight class="toolbar-icon" />
      </button>
    </header>

    <div class="picker-grid picker-grid--year">
      <button
        v-for="cell in yearCells"
        :key="cell.key"
        class="picker-cell"
        :class="{
          'picker-cell--selected': cell.isSelected,
          'picker-cell--current': cell.isCurrent,
          'picker-cell--has-data': cell.hasData && !cell.isSelected,
        }"
        @click="selectYear(cell.key)"
      >
        {{ cell.label }}
      </button>
    </div>

    <button class="today-button" @click="goToCurrentYear">回到本年</button>
  </section>
</template>

<style scoped>
.selector-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-glass-ivory-72);
}

.selector-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
}

.selector-title {
  text-align: center;
  font-size: 0.95rem;
  color: var(--color-text-main);
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-interactive);
  color: var(--color-text-main);
  cursor: pointer;
}

.toolbar-icon {
  width: 1.15rem;
  height: 1.15rem;
}

.picker-grid--year {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.picker-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-main);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.picker-cell:hover {
  border-color: var(--color-border-strong);
}

.picker-cell--selected {
  border-width: 2px;
  border-color: var(--color-border-selected-strong);
}

.picker-cell--current {
  border-color: var(--color-border-calendar-today);
}

.picker-cell--has-data {
  background: var(--color-accent-muted);
}

.today-button {
  justify-self: start;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-interactive);
  color: var(--color-text-subtle);
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
```

- [ ] **Step 3: 替换 ReportsSidebar 中的年份选择器**

在 `ReportsSidebar.vue` 中，将 `preset === 'year'` 分支中的 `<section class="selector-card">...</section>` 整体替换为：

```vue
<YearPickerGrid
  :selected-year="Number.parseInt(yearValue, 10)"
  :has-data-years="new Set(yearReports.map(r => String(r.year)))"
  @update:selected-year="year => $emit('update:yearValue', String(year))"
/>
```

并在 script 顶部添加 import：

```typescript
import YearPickerGrid from '../../../shared/YearPickerGrid.vue'
```

原有 CSS 中 `.selector-card` / `.selector-toolbar` / `.picker-grid--year` / `.picker-cell` / `.today-button` 等样式可以保留（它们仍被 YearPickerGrid 使用），但勿删除。

- [ ] **Step 4: 验证编译**

```powershell
npx vue-tsc --noEmit
```

---

### Task 11: 导航按钮 — 3按钮→2×2网格

**Files:**
- Modify: `src/components/workspace/components/WorkspaceSidebar/WorkspaceSidebar.vue`
- Modify: `src/components/workspace/components/WorkspaceSidebar/WorkspaceSidebar.css`

- [ ] **Step 1: 修改 WorkspaceSidebar.vue**

在 `<script setup>` 中导入 `Clock` 图标：

```typescript
import {
  ChartColumn,
  Clock,
  FolderOpen,
  PencilLine,
  SlidersHorizontal,
} from 'lucide-vue-next'
```

修改 props 和 emits：

```typescript
defineProps<{
  workspacePath: string | null
  activePanel: 'journal' | 'reports' | 'settings' | 'timeline'
}>()

defineEmits<{
  chooseWorkspace: []
  openJournal: []
  openTimeline: []
  openReports: []
  openSettings: []
}>()
```

模板中，将 `.primary-nav` 中的 3 个按钮改为 4 个：

```html
<nav class="primary-nav" aria-label="一级导航">
  <button
    class="nav-button"
    :class="{ 'nav-button--active': activePanel === 'journal' }"
    type="button"
    @click="$emit('openJournal')"
  >
    <PencilLine class="nav-button-icon" aria-hidden="true" />
    <span>写作</span>
  </button>
  <button
    class="nav-button"
    :class="{ 'nav-button--active': activePanel === 'timeline' }"
    type="button"
    @click="$emit('openTimeline')"
  >
    <Clock class="nav-button-icon" aria-hidden="true" />
    <span>时间轴</span>
  </button>
  <button
    class="nav-button"
    :class="{ 'nav-button--active': activePanel === 'reports' }"
    type="button"
    @click="$emit('openReports')"
  >
    <ChartColumn class="nav-button-icon" aria-hidden="true" />
    <span>报告</span>
  </button>
  <button
    class="nav-button"
    :class="{ 'nav-button--active': activePanel === 'settings' }"
    type="button"
    @click="$emit('openSettings')"
  >
    <SlidersHorizontal class="nav-button-icon" aria-hidden="true" />
    <span>设置</span>
  </button>
</nav>
```

- [ ] **Step 2: 修改 CSS — 网格布局**

在 `WorkspaceSidebar.css` 中将：

```css
.primary-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
```

改为：

```css
.primary-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
```

---

### Task 12: AppShellPage — 集成时间轴面板

**Files:**
- Modify: `src/app/pages/AppShellPage.vue`
- Modify: `src/app/composables/useAppShell.ts`

- [ ] **Step 1: 在 useAppShell.ts 中新增 timeline 状态和导出**

先读取 `src/app/composables/useAppShell.ts` 了解结构。

需要在 `useAppShell()` 的返回对象中新增：

```typescript
openTimelinePage: () => void
selectedTimelineYear: Ref<number>
timelineData: Ref<TimelineYearData | null>
handleSelectTimelineYear: (year: number) => void
handleRebuildTimeline: () => void
handleCancelTimelineRebuild: () => void
isRebuildingTimeline: Ref<boolean>
timelineRebuildProgress: Ref<{ weekLabel: string; current: number; total: number } | null>
```

具体实现：创建一个新的 composable `src/components/timeline/composables/useTimeline.ts`，然后由 `useAppShell.ts` 导入并聚合。

- [ ] **Step 2: 创建 timeline composable**

`src/components/timeline/composables/useTimeline.ts`：

```typescript
import { ref } from 'vue'
import type { TimelineYearData } from '../../../types/timeline'
import dayjs from 'dayjs'

export function useTimeline(workspacePath: Ref<string | null>) {
  const selectedTimelineYear = ref(dayjs().year())
  const timelineData = ref<TimelineYearData | null>(null)
  const isRebuildingTimeline = ref(false)
  const timelineRebuildProgress = ref<{ weekLabel: string; current: number; total: number } | null>(null)
  let unlistenProgress: (() => void) | null = null

  async function loadTimeline(year: number) {
    if (!workspacePath.value) return
    timelineData.value = await window.dairy.getTimeline({
      workspacePath: workspacePath.value,
      year,
    })
  }

  function handleSelectTimelineYear(year: number) {
    selectedTimelineYear.value = year
    loadTimeline(year)
  }

  async function handleRebuildTimeline() {
    if (!workspacePath.value) return
    isRebuildingTimeline.value = true

    unlistenProgress = window.dairy.onTimelineRebuildProgress((progress) => {
      timelineRebuildProgress.value = progress
    })

    try {
      await window.dairy.rebuildTimeline(workspacePath.value)
      await loadTimeline(selectedTimelineYear.value)
    } finally {
      isRebuildingTimeline.value = false
      timelineRebuildProgress.value = null
      if (unlistenProgress) {
        unlistenProgress()
        unlistenProgress = null
      }
    }
  }

  function handleCancelTimelineRebuild() {
    window.dairy.cancelTimelineRebuild()
  }

  function openTimelinePage() {
    if (!workspacePath.value) return
    loadTimeline(selectedTimelineYear.value)
  }

  return {
    selectedTimelineYear,
    timelineData,
    isRebuildingTimeline,
    timelineRebuildProgress,
    handleSelectTimelineYear,
    handleRebuildTimeline,
    handleCancelTimelineRebuild,
    openTimelinePage,
    loadTimeline,
  }
}
```

- [ ] **Step 3: 在 useAppShell.ts 中导入并使用**

在 `useAppShell()` 函数中：

```typescript
import { useTimeline } from '../../../components/timeline/composables/useTimeline'
```

在函数体内部（workspacePath 定义之后）调用：

```typescript
const timeline = useTimeline(workspacePath)
```

在 return 对象中展开：

```typescript
...timeline,
```

- [ ] **Step 4: 修改 AppShellPage.vue**

在 WorkspaceSidebar 组件的绑定中增加 `@open-timeline` 事件：

```html
<WorkspaceSidebar
  ...
  @open-timeline="rightPanel = 'timeline'; openTimelinePage()"
  ...
>
```

在 `.editor-shell` 的 `v-else-if` 链中增加 timeline 分支：

```html
<section v-else-if="rightPanel === 'timeline'" class="timeline-area">
  <TimelinePage
    :workspace-path="workspacePath"
    :selected-year="selectedTimelineYear"
    :timeline-data="timelineData"
    :is-rebuilding="isRebuildingTimeline"
    :rebuild-progress="timelineRebuildProgress"
    @select-year="handleSelectTimelineYear"
    @rebuild="handleRebuildTimeline"
    @cancel-rebuild="handleCancelTimelineRebuild"
  />
</section>
```

在 script 中 import `TimelinePage`：

```typescript
import TimelinePage from '../../components/timeline/TimelinePage.vue'
```

并在 script setup 的顶部解构新增的 refs：

```typescript
const {
  ...
  openTimelinePage,
  selectedTimelineYear,
  timelineData,
  isRebuildingTimeline,
  timelineRebuildProgress,
  handleSelectTimelineYear,
  handleRebuildTimeline,
  handleCancelTimelineRebuild,
  ...
} = useAppShell()
```

---

### Task 13: 时间轴页面组件 — TimelinePage

**Files:**
- Create: `src/components/timeline/TimelinePage.vue`
- Create: `src/components/timeline/TimelinePage.css`

- [ ] **Step 1: 创建 TimelinePage.vue**

```vue
<script setup lang="ts">
import type { TimelineYearData } from '../../types/timeline'
import TimelineSidebar from './TimelineSidebar.vue'
import TimelineView from './TimelineView.vue'

defineProps<{
  workspacePath: string | null
  selectedYear: number
  timelineData: TimelineYearData | null
  isRebuilding: boolean
  rebuildProgress: { weekLabel: string; current: number; total: number } | null
}>()

defineEmits<{
  selectYear: [year: number]
  rebuild: []
  cancelRebuild: []
}>()
</script>

<template>
  <div class="timeline-page">
    <TimelineSidebar
      :selected-year="selectedYear"
      :has-data-years="timelineData ? new Set([String(selectedYear)]) : new Set()"
      :is-rebuilding="isRebuilding"
      :rebuild-progress="rebuildProgress"
      @select-year="$emit('selectYear', $event)"
      @rebuild="$emit('rebuild')"
      @cancel-rebuild="$emit('cancelRebuild')"
    />
    <div class="timeline-content">
      <div v-if="!workspacePath" class="timeline-empty">
        <h3>人生时间轴</h3>
        <p>先选择一个工作区，右侧这里会显示时间轴。</p>
      </div>
      <TimelineView
        v-else
        :events="timelineData?.events ?? []"
        :year="selectedYear"
      />
    </div>
  </div>
</template>

<style scoped src="./TimelinePage.css"></style>
```

- [ ] **Step 2: 创建 TimelinePage.css**

```css
.timeline-page {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100%;
}

.timeline-content {
  overflow-y: auto;
  padding: 2rem;
}

.timeline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-subtle);
}

.timeline-empty h3 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  color: var(--color-text-main);
}
```

---

### Task 14: TimelineSidebar — 左侧面板

**Files:**
- Create: `src/components/timeline/TimelineSidebar.vue`
- Create: `src/components/timeline/TimelineSidebar.css`

- [ ] **Step 1: 创建 TimelineSidebar.vue**

```vue
<script setup lang="ts">
import YearPickerGrid from '../../shared/YearPickerGrid.vue'

defineProps<{
  selectedYear: number
  hasDataYears: Set<string>
  isRebuilding: boolean
  rebuildProgress: { weekLabel: string; current: number; total: number } | null
}>()

const emit = defineEmits<{
  selectYear: [year: number]
  rebuild: []
  cancelRebuild: []
}>()

function handleRebuild() {
  const confirmed = window.confirm(
    'AI 将完整扫描本年所有日记重新生成时间轴，预计消耗较多 token，确定继续？',
  )
  if (confirmed) {
    emit('rebuild')
  }
}
</script>

<template>
  <aside class="timeline-sidebar">
    <YearPickerGrid
      :selected-year="selectedYear"
      :has-data-years="hasDataYears"
      @update:selected-year="year => emit('selectYear', year)"
    />

    <div class="timeline-actions">
      <button
        v-if="!isRebuilding"
        class="rebuild-button"
        @click="handleRebuild"
      >
        重新整理本年度时间轴
      </button>
      <div v-else class="rebuild-status">
        <p class="rebuild-progress-text">
          正在整理... {{ rebuildProgress?.weekLabel }}
          （{{ rebuildProgress?.current }}/{{ rebuildProgress?.total }}）
        </p>
        <button class="cancel-button" @click="emit('cancelRebuild')">
          取消
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped src="./TimelineSidebar.css"></style>
```

- [ ] **Step 2: 创建 TimelineSidebar.css**

```css
.timeline-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.timeline-actions {
  display: grid;
  gap: 0.75rem;
}

.rebuild-button {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-interactive);
  color: var(--color-text-subtle);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 160ms ease;
}

.rebuild-button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-main);
}

.rebuild-status {
  display: grid;
  gap: 0.5rem;
}

.rebuild-progress-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

.cancel-button {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-interactive);
  color: var(--color-text-danger-soft);
  font-size: 0.82rem;
  cursor: pointer;
}
```

---

### Task 15: TimelineView — 垂直时间轴

**Files:**
- Create: `src/components/timeline/TimelineView.vue`
- Create: `src/components/timeline/TimelineView.css`

- [ ] **Step 1: 创建 TimelineView.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { PencilLine } from 'lucide-vue-next'
import type { TimelineEvent } from '../../types/timeline'
import TimelineCard from './TimelineCard.vue'

const EVENT_COLORS = [
  'var(--color-timeline-event-1)',
  'var(--color-timeline-event-2)',
  'var(--color-timeline-event-3)',
  'var(--color-timeline-event-4)',
  'var(--color-timeline-event-5)',
  'var(--color-timeline-event-6)',
  'var(--color-timeline-event-7)',
  'var(--color-timeline-event-8)',
]

const props = defineProps<{
  events: TimelineEvent[]
  year: number
}>()

const monthGroups = computed(() => {
  const groups: Array<{ month: number; events: Array<TimelineEvent & { color: string }> }> = []

  for (let m = 1; m <= 12; m++) {
    const monthEvents = props.events
      .filter((e) => {
        const eventMonth = Number.parseInt(e.date.split('-')[1], 10)
        return eventMonth === m
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    if (monthEvents.length > 0) {
      groups.push({
        month: m,
        events: monthEvents.map((e, i) => ({
          ...e,
          color: EVENT_COLORS[i % EVENT_COLORS.length],
        })),
      })
    }
  }

  return groups
})

const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]
</script>

<template>
  <div class="timeline-view">
    <template v-if="monthGroups.length === 0">
      <div class="timeline-empty-state">
        <h3>{{ year }} 年暂无事件</h3>
        <p>在左侧点击"重新整理本年度时间轴"让 AI 自动提取事件</p>
      </div>
    </template>

    <template v-for="group in monthGroups" :key="group.month">
      <div class="timeline-month">
        <div class="timeline-month-label">{{ MONTH_LABELS[group.month - 1] }}</div>

        <div class="timeline-events">
          <div
            v-for="event in group.events"
            :key="event.id"
            class="timeline-event-row"
          >
            <div class="timeline-event-marker">
              <div
                v-if="event.dateEnd"
                class="timeline-event-range"
                :style="{ backgroundColor: event.color }"
              ></div>
              <div
                v-else
                class="timeline-event-dot"
                :style="{ backgroundColor: event.color }"
              ></div>
            </div>

            <TimelineCard :event="event" :color="event.color" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped src="./TimelineView.css"></style>
```

- [ ] **Step 2: 创建 TimelineView.css**

```css
.timeline-view {
  max-width: 720px;
  margin: 0 auto;
}

.timeline-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--color-text-subtle);
}

.timeline-empty-state h3 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  color: var(--color-text-main);
}

.timeline-month {
  margin-bottom: 2rem;
}

.timeline-month-label {
  padding: 0.5rem 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-accent);
  border-bottom: 2px solid var(--color-border);
}

.timeline-events {
  display: grid;
  gap: 0.5rem;
  padding-top: 1rem;
  padding-left: 1.2rem;
  border-left: 2px solid var(--color-border);
}

.timeline-event-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.timeline-event-marker {
  flex-shrink: 0;
  width: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0.4rem;
}

.timeline-event-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.timeline-event-range {
  width: 0.35rem;
  min-height: 1.2rem;
  border-radius: 4px;
}
```

---

### Task 16: TimelineCard — 事件卡片

**Files:**
- Create: `src/components/timeline/TimelineCard.vue`
- Create: `src/components/timeline/TimelineCard.css`

- [ ] **Step 1: 创建 TimelineCard.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FileText } from 'lucide-vue-next'
import type { TimelineEvent } from '../../types/timeline'

const props = defineProps<{
  event: TimelineEvent
  color: string
}>()

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function handleJumpToDiary(date: string) {
  // 触发日记跳转 —— 需要从父组件传入回调
}
</script>

<template>
  <div
    class="timeline-card"
    :class="{ 'timeline-card--expanded': isExpanded }"
  >
    <div class="timeline-card-header" @click="toggleExpand">
      <div class="timeline-card-title">{{ event.title }}</div>
      <div class="timeline-card-date">
        {{ event.date }}
        <template v-if="event.dateEnd"> ~ {{ event.dateEnd }}</template>
      </div>
    </div>

    <div class="timeline-card-summary">{{ event.summary }}</div>

    <div v-if="isExpanded" class="timeline-card-detail">
      <p>{{ event.detail }}</p>
      <div class="timeline-card-links">
        <button
          v-for="d in event.diaryDates"
          :key="d"
          class="timeline-card-diary-link"
          @click="handleJumpToDiary(d)"
        >
          <FileText class="link-icon" />
          {{ d }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TimelineCard.css"></style>
```

- [ ] **Step 2: 创建 TimelineCard.css**

```css
.timeline-card {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-glass-ivory-72);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.timeline-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-soft);
}

.timeline-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.timeline-card-title {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-card-date {
  flex-shrink: 0;
  font-size: 0.78rem;
  color: var(--color-text-subtle);
}

.timeline-card-summary {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--color-text-subtle);
  line-height: 1.5;
}

.timeline-card-detail {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-soft);
}

.timeline-card-detail p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.timeline-card-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.timeline-card-diary-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-interactive);
  color: var(--color-text-link);
  font-size: 0.78rem;
  cursor: pointer;
}

.timeline-card-diary-link:hover {
  border-color: var(--color-border-strong);
}

.link-icon {
  width: 0.85rem;
  height: 0.85rem;
}
```

---

### 后续任务

以下任务在当前 plan 中标记，具体实现留到后续：

- [ ] **日记跳转**：点击 TimelineCard 中的日记链接 → 切换到 journal 面板并加载对应日期日记
- [ ] **颜色分配算法**：TS 端实现 HSV 色轮均分
- [ ] **重叠偏移渲染**：TimelineView 中实现重叠事件的横向偏移
- [ ] **时间段段渲染**：时间段事件显示为纵向色段
- [ ] **跨月时间段**：时间段事件跨越多个月时的渲染
- [ ] **保存后自动增量扫描**：hook 到日记保存流程，异步触发 AI 扫描
- [ ] **托盘菜单**更新：`onNavigateMainPanel` 支持 `'timeline'`

---

### Task 17: 验证 — 完整构建测试

- [ ] **Step 1: 编译检查**

```powershell
npx vue-tsc --noEmit
```

- [ ] **Step 2: 开发环境启动**

```powershell
npm run dev
```

Expected: 应用正常启动，左上角导航栏变为 2×2 网格，点击「时间轴」按钮进入新面板。

---

### 自检清单

- [ ] 类型定义完整且被导出（Task 1）
- [ ] IPC 通道命名一致：`types/api.ts` ↔ `preload.ts` ↔ `ipc/timeline.ts` ↔ `ipc-channels.ts`
- [ ] YearPickerGrid 从 ReportsSidebar 正确抽取，旧功能不受影响
- [ ] 导航 2×2 网格的 CSS `grid-template-columns: repeat(2, ...)` 正确
- [ ] 事件颜色 token 在 `content.css` 和 `dark.css` 中都定义了
- [ ] `RightPanel` 类型包含 `'timeline'`
- [ ] AppShellPage `v-else-if` 链正确处理 timeline 分支
- [ ] useAppShell 返回值包含 timeline composable 的全部导出
