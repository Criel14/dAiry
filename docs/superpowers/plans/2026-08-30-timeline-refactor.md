# 时间轴重构（仅时间点 + 确认制提取）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 时间轴改为仅时间点事件；每日自动整理只返回 `timelineWorthy` 布尔判断，用户确认后才用"当天全文 + 近 7 天全文 + 画像/补充资料"提取事件并落盘。

**Architecture:** 数据层移除 `dateEnd`（读取时自然降级旧数据）；自动整理调用（`generateDailyInsights`）新增 `timelineWorthy` 返回；主进程新增 `addTimelineDayEvent`（提取 + upsert 落盘，一天最多一个事件、覆盖更新），同时供 IPC 与 MCP 新工具 `dairy_record_timeline_event` 复用；旧 `updateTimelineForDay` 自动日更链路整体删除。

**Tech Stack:** Electron + Vue 3 + TypeScript + Vite + Vitest + dayjs + MCP SDK

**参考规范:** `docs/superpowers/specs/2026-08-30-timeline-refactor-design.md`

---

## 任务一览

| # | 任务 | 提交信息 |
|---|------|---------|
| 1 | 类型与 service 纯逻辑（TDD） | `refactor(timeline): 移除 dateEnd 字段并支持单日事件 upsert` |
| 2 | 自动整理返回 timelineWorthy | `feat(ai): 自动整理返回 timelineWorthy 判断` |
| 3 | timeline/ai.ts 重构（提取函数 + 删除旧日更链路） | `refactor(timeline): 新增确认制单日事件提取，删除自动日更链路` |
| 4 | IPC 与 preload 新增 add-timeline-day-event | `feat(timeline): 新增 timeline:add-day-event IPC 通道` |
| 5 | 前端确认流程 | `feat(timeline): 自动整理后弹框确认是否记录时间轴事件` |
| 6 | MCP 新工具 dairy_record_timeline_event | `feat(mcp): 新增 dairy_record_timeline_event 并透传 timelineWorthy` |
| 7 | 展示层移除时间段样式 | `refactor(timeline): 时间轴仅渲染时间点事件` |
| 8 | 文档同步 | `docs(timeline): 同步时间轴重构后的文档与约束` |
| 9 | 全量验证 | （无提交） |

---

## Task 1: 类型与 service 纯逻辑（TDD）

**Files:**
- Modify: `src/types/timeline.ts`
- Modify: `electron/main/timeline/service.ts`
- Test: `tests/timeline/service.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

创建 `tests/timeline/service.test.ts`（目录 `tests/timeline/` 新建）：

```ts
import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from '../../src/types/timeline'
import {
  mergeEvents,
  stripLegacyDateEnd,
  upsertEventForDate,
} from '../../electron/main/timeline/service'

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'evt_20260315_001',
    date: '2026-03-15',
    title: '完成项目文档',
    detail: '写完文档并通过评审。',
    diaryDates: ['2026-03-15'],
    ...overrides,
  }
}

describe('stripLegacyDateEnd', () => {
  it('removes legacy dateEnd field from old events', () => {
    const legacy = {
      ...makeEvent(),
      dateEnd: '2026-03-20',
    } as TimelineEvent & { dateEnd?: unknown }

    const result = stripLegacyDateEnd(legacy)

    expect(result).not.toHaveProperty('dateEnd')
    expect(result.date).toBe('2026-03-15')
  })
})

describe('upsertEventForDate', () => {
  it('creates a new event with stable id when date has no event', () => {
    const result = upsertEventForDate([], '2026-03-15', {
      title: '完成项目文档',
      detail: '写完并通过评审。',
    })

    expect(result.created).toBe(true)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toEqual({
      id: 'evt_20260315_001',
      date: '2026-03-15',
      title: '完成项目文档',
      detail: '写完并通过评审。',
      diaryDates: ['2026-03-15'],
    })
  })

  it('updates title and detail of existing event and keeps id', () => {
    const existing = [makeEvent({ id: 'evt_20260315_001', title: '旧标题' })]

    const result = upsertEventForDate(existing, '2026-03-15', {
      title: '新标题',
      detail: '新详情',
    })

    expect(result.created).toBe(false)
    expect(result.events[0].id).toBe('evt_20260315_001')
    expect(result.events[0].title).toBe('新标题')
    expect(result.events[0].detail).toBe('新详情')
  })
})

describe('mergeEvents', () => {
  it('deduplicates by id with incoming overriding existing', () => {
    const existing = [makeEvent({ id: 'a', title: '旧' })]
    const incoming = [
      makeEvent({ id: 'a', title: '新' }),
      makeEvent({ id: 'b' }),
    ]

    const merged = mergeEvents(existing, incoming)

    expect(merged).toHaveLength(2)
    expect(merged.find((e) => e.id === 'a')?.title).toBe('新')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/timeline/service.test.ts`
Expected: 编译失败，`stripLegacyDateEnd`/`upsertEventForDate` 不存在

- [ ] **Step 3: 修改类型 `src/types/timeline.ts`**

删除 `dateEnd` 字段，version 语义更新，并新增 IPC 输入/结果类型：

```ts
export interface TimelineEvent {
  id: string
  date: string
  title: string
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

export interface AddTimelineDayEventInput {
  workspacePath: string
  date: string
}

export interface AddTimelineDayEventResult {
  recorded: boolean
  reason?: 'empty'
  event?: TimelineEvent
}
```

- [ ] **Step 4: 修改 `electron/main/timeline/service.ts`**

完整替换文件内容为：

```ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TimelineEvent, TimelineYearData } from '../../../src/types/timeline'
import { resolveTimelineDirPath } from '../workspace/paths'

export function getTimelineFilePath(workspacePath: string, year: number): string {
  return join(resolveTimelineDirPath(workspacePath), `${year}.json`)
}

// 旧版本数据可能带 dateEnd 字段（时间段事件），读取时统一剥离，
// 旧事件自动降级为以 date 为准的时间点事件，无需迁移脚本。
export function stripLegacyDateEnd(event: TimelineEvent): TimelineEvent {
  const { dateEnd, ...rest } = event as TimelineEvent & { dateEnd?: unknown }
  return rest
}

export function readTimelineYear(workspacePath: string, year: number): TimelineYearData | null {
  const filePath = getTimelineFilePath(workspacePath, year)

  if (!existsSync(filePath)) {
    return null
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as TimelineYearData
  return {
    ...data,
    events: data.events.map(stripLegacyDateEnd),
  }
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

// 单日事件 upsert：同一天已有事件则覆盖 title/detail（保留原 id），
// 否则新增一条 id 固定为 evt_{YYYYMMDD}_001 的时间点事件。
export function upsertEventForDate(
  events: TimelineEvent[],
  date: string,
  draft: { title: string; detail: string },
): { events: TimelineEvent[]; created: boolean } {
  const index = events.findIndex((e) => e.date === date)

  if (index !== -1) {
    const next = [...events]
    next[index] = {
      ...next[index],
      title: draft.title,
      detail: draft.detail,
    }
    return { events: next, created: false }
  }

  const id = `evt_${date.replace(/-/g, '')}_001`
  return {
    events: [
      ...events,
      {
        id,
        date,
        title: draft.title,
        detail: draft.detail,
        diaryDates: [date],
      },
    ],
    created: true,
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test -- tests/timeline/service.test.ts`
Expected: 3 个 describe 全部 PASS

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 无错误（注意：`electron/main/timeline/ai.ts` 仍引用 `dateEnd`，本任务允许报错，Task 3 会一并修复。若 typecheck 报 timeline/ai.ts 相关错误属预期）

- [ ] **Step 7: 提交**

```bash
git add src/types/timeline.ts electron/main/timeline/service.ts tests/timeline/service.test.ts
git commit -m "refactor(timeline): 移除 dateEnd 字段并支持单日事件 upsert"
```

---

## Task 2: 自动整理返回 timelineWorthy

**Files:**
- Modify: `electron/main/ai/prompts/daily-organize.system.md`
- Modify: `src/types/ai.ts`
- Modify: `electron/main/ai/journal-ai-service.ts`

- [ ] **Step 1: 修改提示词 `electron/main/ai/prompts/daily-organize.system.md`**

在第 3 个任务 `mood` 之后、`事实与安全约束` 之前插入一段：

```md
`timelineWorthy` 判断规则：

- `timelineWorthy` 表示今天是否有值得记录到时间轴的大事件，只输出布尔值。
- 值得记录（`true`）：公司大活动（如年会、团建、发布会）、家人来访、个人娱乐活动（如演唱会、旅行）、重大决定、里程碑事件、重要聚会等当天真正发生的较有意义的事。
- 不值得记录（`false`）：普通日常、吃了什么、起床很晚、例行上班上学、碎片化心情记录等。
- 宁可保守：平淡的一天返回 `false`。
```

将输出约束部分修改为：

```md
输出约束：

- 只返回一个 JSON 对象，不要输出 Markdown，不要解释，不要添加代码块。
- JSON 结构固定为：`{"summary":"...","tags":["..."],"mood":0,"timelineWorthy":true}`
- `summary` 必须是非空字符串。
- `tags` 必须是包含 3 到 8 个非空字符串的数组。
- `mood` 必须是 `-5` 到 `5` 的整数。
- `timelineWorthy` 必须是布尔值，不要写成字符串或数字。
- `tags` 中不要出现重复项。
- 不要把 `summary`、`tags`、`mood` 写成 `null`、对象或布尔值。
```

- [ ] **Step 2: 修改 `src/types/ai.ts`**

`GenerateDailyInsightsResult` 增加字段：

```ts
export interface GenerateDailyInsightsResult {
  summary: string
  tags: string[]
  mood: number
  existingTags: string[]
  newTags: string[]
  timelineWorthy: boolean
}
```

- [ ] **Step 3: 修改 `electron/main/ai/journal-ai-service.ts`**

两处改动：

`DailyInsightsPayload`（约第 17-21 行）增加字段：

```ts
interface DailyInsightsPayload {
  summary?: unknown
  tags?: unknown
  mood?: unknown
  timelineWorthy?: unknown
}
```

`normalizeDailyInsights` 的 return（约第 82-88 行）增加 `timelineWorthy` 归一化：

```ts
  return {
    summary,
    tags: dedupedTags,
    mood,
    existingTags,
    newTags,
    timelineWorthy: typeof payload.timelineWorthy === 'boolean' ? payload.timelineWorthy : false,
  }
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无新增错误（timeline/ai.ts 的既有错误属 Task 3 范围）

- [ ] **Step 5: 提交**

```bash
git add electron/main/ai/prompts/daily-organize.system.md src/types/ai.ts electron/main/ai/journal-ai-service.ts
git commit -m "feat(ai): 自动整理返回 timelineWorthy 判断"
```

---

## Task 3: timeline/ai.ts 重构（提取函数 + 删除旧日更链路）

**Files:**
- Create: `electron/main/ai/prompts/timeline-event-extract.system.md`
- Modify: `electron/main/ai/prompt-loader.ts`
- Modify: `electron/main/timeline/ai.ts`
- Modify: `electron/main/ipc/journal.ts`
- Modify: `electron/main/journal/write-flow.ts`

- [ ] **Step 1: 新建提示词 `electron/main/ai/prompts/timeline-event-extract.system.md`**

```md
你是一个人生时间轴整理助手。你的任务是根据用户当天的日记，整理出当天最值得记录的一条人生事件。

## 提取规则

1. 事件必须基于当天日记原文，不能无中生有
2. 只整理当天真正发生的较有意义的事：公司大活动（年会、团建、发布会）、家人来访、个人娱乐活动（演唱会、旅行）、重大决定、里程碑事件、重要聚会等
3. 不要提取"今天吃了什么""起床很晚""例行上班"等日常琐事
4. 标题：4-12 字，简洁有力
5. 详情：80-200 字，结合日记原文扩展，字符串内的换行必须用 \\n 转义，双引号必须用 \\" 转义
6. 近 7 天日记、用户画像与补充知识仅用于背景理解，不要据此创建非当天发生的事件
7. 若当天确实没有值得记录的大事件，返回空标题和空详情

## 输出格式

你必须返回严格的 JSON 对象，不要包含 markdown 代码块标记。

正确示例：
{"title": "公司周年庆活动", "detail": "公司举办十周年庆典，\\n下午全员参加，晚上还有晚宴和抽奖。"}

当天无大事时返回：
{"title": "", "detail": ""}
```

- [ ] **Step 2: 注册新提示词 `electron/main/ai/prompt-loader.ts`**

在 `PROMPT_FILE_MAP` 中新增一行：

```ts
  timelineEventExtractSystem: new URL('./prompts/timeline-event-extract.system.md', import.meta.url),
```

（加在 `timelineExtractSystem` 行之后）

- [ ] **Step 3: 重写 `electron/main/timeline/ai.ts`**

删除函数：`extractEventsFromDay`（第 79-158 行）、`updateTimelineForDay`（第 337-377 行）。
保留函数：`extractJsonObject`、`fixUnescapedStrings`、`__timelineCancelTokens`、`TimelineCancelledError`、`buildBatches`、`rebuildTimelineYear`、`cancelTimelineRebuild`。

头部 import 调整（第 1-12 行替换为）：

```ts
import dayjs from 'dayjs'
import type { TimelineEvent } from '../../../src/types/timeline'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { readAppConfig, normalizeAiSettings } from '../app-config'
import { readSupplement } from '../ai/context'
import { readAiApiKey } from '../secrets'
import { createAiChatClient } from '../ai/provider-factory'
import { withAiRetry } from '../ai/retry'
import { loadPrompt } from '../ai/prompt-loader'
import { readJournalDocument } from '../journal/document'
import { readUserProfile } from '../profile/profile-service'
import {
  mergeEvents,
  stripLegacyDateEnd,
  upsertEventForDate,
} from './service'
```

`rebuildTimelineYear` 的返回值处（约第 327 行）改为对事件统一剥离旧字段：

```ts
  return { events: allEvents.map(stripLegacyDateEnd), diaryBatchCount }
```

在文件末尾新增（替换原 `updateTimelineForDay` 位置）：

```ts
const MAX_RECENT_BODY_LENGTH = 2200

function truncateRecentBody(body: string) {
  const normalizedBody = body.trim()
  if (normalizedBody.length <= MAX_RECENT_BODY_LENGTH) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, MAX_RECENT_BODY_LENGTH)}...`
}

export interface ExtractedDayEvent {
  title: string
  detail: string
}

function extractDayEventJson(rawText: string): { title?: unknown; detail?: unknown } {
  let text = rawText.trim()

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim()
  }

  try {
    return JSON.parse(text) as { title?: unknown; detail?: unknown }
  } catch {
    // 继续
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const candidate = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1')
    try {
      return JSON.parse(candidate) as { title?: unknown; detail?: unknown }
    } catch {
      // 继续
    }
  }

  const preview = rawText.length > 300 ? rawText.slice(0, 300) + '...' : rawText
  throw new Error(`大模型返回内容无法解析为 JSON。返回内容预览：\n${preview}`)
}

// 确认制单日事件提取：当天全文 + 近 7 天全文（截断保护）+ 画像/补充资料（非空才拼）
export async function extractTimelineEventForDay(
  workspacePath: string,
  date: string,
): Promise<ExtractedDayEvent> {
  assertValidDate(date)

  const [config, systemPrompt, supplement, userProfile] = await Promise.all([
    readAppConfig(),
    loadPrompt('timelineEventExtractSystem'),
    readSupplement(workspacePath),
    readUserProfile(workspacePath, date.slice(0, 4)),
  ])

  const settings = normalizeAiSettings(config.ai)
  const apiKey = await readAiApiKey(settings.providerType)

  if (!apiKey) {
    throw new Error('请先在设置页保存当前 provider 的 API Key。')
  }

  const { body } = await readJournalDocument(
    resolveJournalEntryFilePath(workspacePath, date),
  )

  if (!body.trim()) {
    throw new Error('当天还没有写日记，无法整理时间轴事件。')
  }

  const recentBodies: string[] = []
  for (let offset = 7; offset >= 1; offset -= 1) {
    const targetDate = dayjs(date).subtract(offset, 'day').format('YYYY-MM-DD')

    try {
      const document = await readJournalDocument(
        resolveJournalEntryFilePath(workspacePath, targetDate),
      )
      if (document.body.trim()) {
        recentBodies.push(`## ${targetDate}\n${truncateRecentBody(document.body)}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }
  }

  const userPrompt = [
    `业务日期：${date}`,
    recentBodies.length > 0
      ? `近期日记（过去 7 天，仅作背景参考）：\n${recentBodies.join('\n\n')}`
      : '',
    supplement.trim() ? `补充知识：\n${supplement.trim()}` : '',
    userProfile.trim() ? `用户画像：\n${userProfile.trim()}` : '',
    '当日日记：',
    body,
  ]
    .filter(Boolean)
    .join('\n\n')

  const responseText = await withAiRetry(
    (timeoutMs) => createAiChatClient(settings, apiKey, timeoutMs),
    (client) =>
      client.completeJson({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    { minTimeoutMs: 120_000, label: '时间轴事件提取' },
  )

  const payload = extractDayEventJson(responseText)
  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const detail = typeof payload.detail === 'string' ? payload.detail.trim() : ''

  return { title, detail }
}

// 提取并落盘单日事件（IPC 与 MCP 共用）：同一天已有事件则覆盖更新
export async function addTimelineDayEvent(
  workspacePath: string,
  date: string,
): Promise<{ recorded: boolean; reason?: 'empty'; event?: TimelineEvent }> {
  const { title, detail } = await extractTimelineEventForDay(workspacePath, date)

  if (!title.trim()) {
    return { recorded: false, reason: 'empty' }
  }

  const year = Number.parseInt(date.split('-')[0], 10)
  const existingData = readTimelineYear(workspacePath, year) ?? {
    year,
    version: 2,
    generatedAt: new Date().toISOString(),
    events: [],
  }

  const { events } = upsertEventForDate(existingData.events, date, { title, detail })
  const updatedData = {
    ...existingData,
    version: 2,
    events,
    generatedAt: new Date().toISOString(),
  }

  writeTimelineYear(workspacePath, updatedData)

  const event = events.find((e) => e.date === date)
  return { recorded: true, event }
}
```

注意：以上新增代码需要 `readTimelineYear`、`writeTimelineYear` 的 import，将第 12 行的 service import 改为：

```ts
import {
  mergeEvents,
  readTimelineYear,
  stripLegacyDateEnd,
  upsertEventForDate,
  writeTimelineYear,
} from './service'
```

- [ ] **Step 4: 修改 `electron/main/ipc/journal.ts`**

删除第 13 行 `import { updateTimelineForDay } from '../timeline/ai'` 与第 65-66 行：

```ts
      // 时间轴日更异步执行，不阻塞主流程
      void updateTimelineForDay(input.workspacePath, input.date)
```

删除后 `generateDailyInsights` handler 变为：

```ts
  ipcMain.handle(
    IPC_CHANNELS.generateDailyInsights,
    async (_event, input: GenerateDailyInsightsInput) => {
      const result = await generateDailyInsights(input)

      // 画像维护异步执行，不阻塞日总结返回，失败也不影响主流程
      void runProfileMaintenance({
        workspacePath: input.workspacePath,
        date: input.date,
        body: input.body,
      })

      return result
    },
  )
```

- [ ] **Step 5: 修改 `electron/main/journal/write-flow.ts`**

1. 删除第 5 行 `import { updateTimelineForDay } from '../timeline/ai'`
2. `WriteJournalEntryFullResult`（第 27-48 行）调整为：

```ts
export interface WriteJournalEntryFullResult {
  date: string
  filePath: string
  mode: JournalWriteMode
  wordCount: number
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
  addedWeather: string[]
  addedLocations: string[]
  addedTags: string[]
  timelineWorthy: boolean
  organize: {
    status: 'ok' | 'skipped' | 'failed'
    warning?: string
  }
  maintenance: {
    profile: 'triggered' | 'skipped'
  }
}
```

3. 函数内 `maintenance` 初始化（约第 116-119 行）改为：

```ts
  let finalFrontmatter = baseFrontmatter
  let addedTags: string[] = []
  let timelineWorthy = false
  let organizeStatus: WriteJournalEntryFullResult['organize'] = { status: 'skipped' }
  let maintenance: WriteJournalEntryFullResult['maintenance'] = {
    profile: 'skipped',
  }
```

4. organize 成功块（约第 142-147 行）改为：

```ts
      organizeStatus = { status: 'ok' }
      timelineWorthy = insights.timelineWorthy
      maintenance = { profile: 'triggered' }

      // 与应用内"自动整理"行为一致：异步触发，失败只记日志，不影响返回
      void runProfileMaintenance({ workspacePath, date: input.date, body: finalBody })
```

5. return 对象（约第 154-169 行）在 `addedTags` 后增加：

```ts
    addedTags,
    timelineWorthy,
    organize: organizeStatus,
    maintenance,
```

- [ ] **Step 6: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 7: 运行测试**

Run: `npm run test`
Expected: 全部 PASS（含既有 bills/theme 测试）

- [ ] **Step 8: 提交**

```bash
git add electron/main/ai/prompts/timeline-event-extract.system.md electron/main/ai/prompt-loader.ts electron/main/timeline/ai.ts electron/main/ipc/journal.ts electron/main/journal/write-flow.ts
git commit -m "refactor(timeline): 新增确认制单日事件提取，删除自动日更链路"
```

---

## Task 4: IPC 与 preload 新增 add-timeline-day-event

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `electron/main/ipc/timeline.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 1: `src/shared/ipc-channels.ts` 新增通道**

在 `// timeline` 区块（`getTimeline` 之前或 `timelineRebuildProgress` 之后）增加：

```ts
  addTimelineDayEvent: 'timeline:add-day-event',
```

- [ ] **Step 2: `electron/main/ipc/timeline.ts` 新增 handler**

第 5 行 import 改为：

```ts
import { rebuildTimelineYear, cancelTimelineRebuild, addTimelineDayEvent } from '../timeline/ai'
```

在 `cancelTimelineRebuild` handler 之后新增：

```ts
  ipcMain.handle(
    IPC_CHANNELS.addTimelineDayEvent,
    async (_event, input: { workspacePath: string; date: string }) => {
      if (typeof input?.workspacePath !== 'string' || !input.workspacePath.trim()) {
        throw new Error('工作区路径无效。')
      }

      return addTimelineDayEvent(input.workspacePath, input.date)
    },
  )
```

同时将 rebuild 落盘的 `version: 1`（第 46 行）改为 `version: 2`。

- [ ] **Step 3: `electron/preload.ts` 新增 API**

在第 117 行 `cancelTimelineRebuild: () => ipcRenderer.invoke(IPC_CHANNELS.cancelTimelineRebuild),` 之后新增：

```ts
  addTimelineDayEvent: (input) => ipcRenderer.invoke(IPC_CHANNELS.addTimelineDayEvent, input),
```

- [ ] **Step 4: `src/types/api.ts` 新增类型**

`import` 中 `TimelineYearData, RebuildTimelineProgress` 改为：

```ts
import type {
  TimelineYearData,
  RebuildTimelineProgress,
  AddTimelineDayEventInput,
  AddTimelineDayEventResult,
} from './timeline'
```

`DairyApi` 中 `onTimelineRebuildProgress` 之后新增：

```ts
  addTimelineDayEvent: (input: AddTimelineDayEventInput) => Promise<AddTimelineDayEventResult>
```

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/shared/ipc-channels.ts electron/main/ipc/timeline.ts electron/preload.ts src/types/api.ts
git commit -m "feat(timeline): 新增 timeline:add-day-event IPC 通道"
```

---

## Task 5: 前端确认流程

**Files:**
- Modify: `src/app/composables/app-shell/state.ts`
- Modify: `src/app/composables/app-shell/journal.ts`
- Modify: `src/app/pages/AppShellPage.vue`

- [ ] **Step 1: `src/app/composables/app-shell/state.ts` 新增状态**

在 `const isGeneratingDailyInsights = ref(false)` 之后新增：

```ts
  const isRecordingTimelineEvent = ref(false)
```

`canGenerateDailyInsights` computed 增加条件：

```ts
  const canGenerateDailyInsights = computed(
    () =>
      viewState.value === 'ready' &&
      Boolean(editorContent.value.trim()) &&
      aiSettingsStatus.value.isConfigured &&
      !isSavingMetadata.value &&
      !isGeneratingDailyInsights.value &&
      !isRecordingTimelineEvent.value,
  )
```

return 对象（`isGeneratingDailyInsights` 行附近）增加：

```ts
    isRecordingTimelineEvent,
```

- [ ] **Step 2: `src/app/composables/app-shell/journal.ts` 修改 `handleGenerateDailyInsights`**

将 `handleGenerateDailyInsights` 函数（第 425-490 行）完整替换为：

```ts
  async function handleGenerateDailyInsights() {
    if (!state.workspacePath.value || state.viewState.value !== 'ready') {
      return
    }

    if (!state.editorContent.value.trim()) {
      state.dailyInsightsStatusMessage.value = '正文为空，暂时无法自动整理。'
      return
    }

    if (!state.aiSettingsStatus.value.isConfigured) {
      state.dailyInsightsStatusMessage.value =
        '请先在设置页完成大模型配置和 API Key 保存。'
      return
    }

    if (
      state.metadataDraft.value.summary.trim() ||
      state.metadataDraft.value.tags.length > 0 ||
      state.metadataDraft.value.mood !== 0
    ) {
      const shouldContinue = await confirmDialog(
        '自动整理会覆盖当前的一句话总结、标签和心情，是否继续？',
      )
      if (!shouldContinue) {
        return
      }
    }

    state.isGeneratingDailyInsights.value = true
    state.dailyInsightsStatusMessage.value = ''

    const targetDate = state.selectedDate.value

    try {
      const result = await window.dairy.generateDailyInsights({
        workspacePath: `${state.workspacePath.value}`,
        date: `${state.selectedDate.value}`,
        body: `${state.editorContent.value}`,
        workspaceTags: [...state.workspaceTags.value],
      })

      if (state.selectedDate.value !== targetDate) {
        state.dailyInsightsStatusMessage.value =
          '整理期间已切换到其他日期，结果已丢弃。'
        return
      }

      state.metadataDraft.value = cloneMetadata({
        ...state.metadataDraft.value,
        mood: result.mood,
        summary: result.summary,
        tags: result.tags,
      })

      state.dailyInsightsStatusMessage.value =
        result.newTags.length > 0
          ? `已生成总结、标签和心情。保存信息后会新增 ${result.newTags.length} 个候选标签。`
          : '已生成总结、标签和心情。'

      await handleTimelineWorthyConfirm(result.timelineWorthy, targetDate)
    } catch (error) {
      state.dailyInsightsStatusMessage.value =
        error instanceof Error ? error.message : '自动整理失败，请稍后重试。'
    } finally {
      state.isGeneratingDailyInsights.value = false
    }
  }

  async function handleTimelineWorthyConfirm(timelineWorthy: boolean, targetDate: string) {
    if (!timelineWorthy) {
      return
    }

    if (state.selectedDate.value !== targetDate) {
      return
    }

    const shouldRecord = await confirmDialog(
      '检测到今天的事情比较有意义，是否记录到时间轴中？',
    )
    if (!shouldRecord) {
      return
    }

    if (state.selectedDate.value !== targetDate) {
      state.dailyInsightsStatusMessage.value = '整理期间已切换到其他日期，时间轴事件已跳过。'
      return
    }

    state.isRecordingTimelineEvent.value = true
    state.dailyInsightsStatusMessage.value = '正在整理时间轴事件...'

    try {
      const recordResult = await window.dairy.addTimelineDayEvent({
        workspacePath: `${state.workspacePath.value}`,
        date: targetDate,
      })

      if (state.selectedDate.value !== targetDate) {
        state.dailyInsightsStatusMessage.value =
          '整理期间已切换到其他日期，时间轴事件结果已丢弃。'
        return
      }

      state.dailyInsightsStatusMessage.value = recordResult.recorded
        ? '已记录到时间轴。'
        : '今天没有整理出值得记录的事件，已跳过。'
    } catch (error) {
      if (state.selectedDate.value === targetDate) {
        state.dailyInsightsStatusMessage.value =
          error instanceof Error ? error.message : '时间轴事件整理失败，请稍后重试。'
      }
    } finally {
      state.isRecordingTimelineEvent.value = false
    }
  }
```

`handleGenerateDailyInsights` 函数体内调用了新函数 `handleTimelineWorthyConfirm`，将其放在同文件 `handleGenerateDailyInsights` 之后（模块内平级函数）。

- [ ] **Step 3: `src/app/pages/AppShellPage.vue` 禁用日历切换**

第 68 行解构处增加 `isRecordingTimelineEvent,`，并将第 220 行日历 `:disabled` 改为：

```vue
          :disabled="isGeneratingDailyInsights || isRecordingTimelineEvent"
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/app/composables/app-shell/state.ts src/app/composables/app-shell/journal.ts src/app/pages/AppShellPage.vue
git commit -m "feat(timeline): 自动整理后弹框确认是否记录时间轴事件"
```

---

## Task 6: MCP 新工具 dairy_record_timeline_event

**Files:**
- Modify: `electron/main/mcp/write-tools.ts`

- [ ] **Step 1: 更新 import**

第 3 行 import 后新增：

```ts
import { addTimelineDayEvent } from '../timeline/ai'
```

- [ ] **Step 2: 更新 `dairy_write_entry` 描述**

第 27 行 description 改为：

```ts
      description:
        '把用户口述的正文真实写入 dAiry 日记（journal/YYYY/MM/YYYY-MM-DD.md），随后由 dAiry 主进程 AI 自动生成总结、标签与心情并回填，并异步维护用户画像。返回值包含 timelineWorthy（今天是否有值得记录到时间轴的大事件）；若为 true，请先向用户确认，再调用 dairy_record_timeline_event 记录到时间轴。这是写操作，会真实落盘；调用前务必与用户确认日期、天气、地点与写入模式。',
```

- [ ] **Step 3: 新增工具注册**

在 `dairy_write_entry` 的 `server.registerTool(...)` 调用之后新增：

```ts
  server.registerTool(
    'dairy_record_timeline_event',
    {
      title: '记录单日时间轴事件',
      description:
        '为指定日期整理并记录一条时间轴事件：AI 读取该天日记全文、近 7 天日记全文，以及用户画像/补充知识（若有），生成事件标题与简要内容，写入该年时间轴（同一天已有事件则覆盖更新）。会消耗一轮 AI 调用，调用前务必与用户确认。',
      inputSchema: {
        date: z.string().describe('日记日期，格式 YYYY-MM-DD'),
      },
    },
    async ({ date }) => {
      try {
        const workspacePath = await resolveWorkspacePath()
        const result = await addTimelineDayEvent(workspacePath, date)
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add electron/main/mcp/write-tools.ts
git commit -m "feat(mcp): 新增 dairy_record_timeline_event 并透传 timelineWorthy"
```

---

## Task 7: 展示层移除时间段样式

**Files:**
- Modify: `src/components/timeline/TimelineView.vue`

- [ ] **Step 1: 移除 dateEnd 分支**

`timeline-event-row` 内的事件标记与日期（第 76-92 行）替换为：

```vue
            <div class="timeline-event-marker">
              <div
                class="timeline-event-dot"
                :style="{ backgroundColor: event.color }"
              ></div>
            </div>

            <span class="timeline-event-date" :style="{ color: event.color }">
              {{ event.date }}
            </span>
```

样式文件 `TimelineView.css` 中的 `.timeline-event-range` 规则保留不动（无害，避免无关样式改动）。

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/timeline/TimelineView.vue
git commit -m "refactor(timeline): 时间轴仅渲染时间点事件"
```

---

## Task 8: 文档同步

**Files:**
- Modify: `docs/system/timeline.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 更新 `docs/system/timeline.md`**

按新行为重写以下小节（保持文档结构）：

1. 概览段落："支持年度全量重建和每日增量更新" → "支持年度全量重建和确认制单日事件记录"
2. `JSON 结构` 示例中删除 `"dateEnd": null,` 一行
3. `### 2.2 日更（自动）` 整节替换为"### 2.2 单日事件记录（确认制）"：

```md
### 2.2 单日事件记录（确认制）

每次用户点击"自动整理"成功后，AI 在返回 `summary/tags/mood` 的同时返回 `timelineWorthy` 布尔值，表示当天是否有值得记录到时间轴的大事件：

- `false`（或缺省）：不弹框，不落任何时间轴数据
- `true`：前端弹确认框"检测到今天的事情比较有意义，是否记录到时间轴中？"
  - 用户取消：跳过，不落任何数据
  - 用户确认：调用 `timeline:add-day-event`，主进程提取事件（同步等待结果），落盘后提示"已记录到时间轴"

```
4. `## 三、AI 调用细节` 中 `### 3.1 日更模式` 整节替换为"### 3.1 单日事件提取模式"：

```md
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
- 单日提取与写盘不依赖"自动整理"的 timelineWorthy 判断结果之外的其他状态；MCP 场景经 `dairy_record_timeline_event` 工具调用同一函数
```

5. `## 六、关键函数位置` 表更新：删除 `extractEventsFromDay`、`updateTimelineForDay` 行；新增 `extractTimelineEventForDay`、`addTimelineDayEvent`、`upsertEventForDate`、`stripLegacyDateEnd` 行，并注明 `extractJsonObject`、`fixUnescapedStrings` 仅供全量重建使用
6. `### IPC 通道` 表新增：

```md
| `addTimelineDayEvent` | `timeline:add-day-event` | renderer→main |
```

7. `### 2.1 全量重建（手动）` 与 `### 3.2 全量重建模式` 保留，但追加一句说明："全量重建提示词的调整（仅时间点、去时间段）留待后续版本，当前重建产出的事件在写入前统一剥离 `dateEnd` 字段，展示为时间点。"
8. `## 七、架构约束` 中"日更只追加不覆盖"改为"单日事件记录：同一天覆盖更新，一天最多一条"

- [ ] **Step 2: 更新 `AGENTS.md`**

1. `### 3.2 全量重建模式` 无关，不改。
2. MCP 约束段（`## 7. PNG 导出约束` 之前的 `MCP 约束` 段落）中"写工具仅三个：..."改为：

```md
- 写工具仅四个：`dairy_write_entry`（写入 `journal/` 与合并 `.dairy/` 候选库）、`dairy_record_timeline_event`（确认制整理并记录单日时间轴事件）、`dairy_generate_report`（异步生成，落盘 `reports/`）、`dairy_read_report`（读取报告）；不暴露敏感配置；写工具工作区固定取 `lastOpenedWorkspace`，不接收 `workspacePath` 参数
```

3. 时间轴相关约束（AI 约束段之后补一条）：

```md
- 时间轴仅支持时间点事件（无时间段）；单日事件在"自动整理"判定 `timelineWorthy` 且用户确认后经 `timeline:add-day-event` 提取落盘（同一天覆盖更新，一天最多一条），`dairy_write_entry` 不自动触发时间轴提取，仅透传 `timelineWorthy` 供外部确认后调用 `dairy_record_timeline_event`
```

- [ ] **Step 3: 更新 `CHANGELOG.md`**

在 Unreleased 区按现有格式补一条：

```md
- 时间轴改为仅时间点事件：自动整理时 AI 只判断当天是否值得记录，用户确认后才整理单日事件（同一天覆盖更新），旧时间段数据自动降级为时间点
```

（参考现有条目风格，放在合适的分组下）

- [ ] **Step 4: 提交**

```bash
git add docs/system/timeline.md AGENTS.md CHANGELOG.md
git commit -m "docs(timeline): 同步时间轴重构后的文档与约束"
```

---

## Task 9: 全量验证

- [ ] **Step 1: 运行全部测试**

Run: `npm run test`
Expected: 全部 PASS

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 手动验证（可选，若可启动应用）**

启动 `npm run dev`，验证：

1. 写一篇包含"公司大活动"内容的日记 → 点击"自动整理" → AI 返回 timelineWorthy=true → 弹框 → 确定 → 提示"正在整理时间轴事件..." → 成功提示"已记录到时间轴" → 打开时间轴页看到圆点事件（当天）
2. 同一天再次确认整理 → 事件标题/详情被覆盖更新
3. 平淡日记 → 自动整理 → 不弹框
4. 自动整理 → 弹框 → 取消 → 时间轴无变化
5. 旧 JSON（含 dateEnd）→ 打开时间轴页 → 显示为时间点（圆点 + 单日期）
6. 时间轴侧边栏"重新整理 X 年时间轴"仍可运行，产出事件展示为时间点

---

## 自检记录

- **规范覆盖**：dateEnd 移除（Task 1、7）；timelineWorthy 并入自动整理（Task 2）；确认制提取 + 近 7 天全文 + 画像/补充资料非空判断（Task 3）；同步等待 + 弹框（Task 5）；一天最多一个覆盖更新（Task 1 upsert）；旧数据自然降级（Task 1）；MCP 透传 + 新工具（Task 6）；rebuild 提示词不动（Task 3 仅剥离 dateEnd）；文档同步（Task 8）。
- **类型一致性**：`AddTimelineDayEventInput`/`AddTimelineDayEventResult` 在 Task 1 定义、Task 4 使用；`timelineWorthy` 在 Task 2 定义、Task 3/5/6 使用；`upsertEventForDate`/`stripLegacyDateEnd` 在 Task 1 实现、Task 3 使用；`addTimelineDayEvent` 在 Task 3 实现、Task 4/6 使用。
