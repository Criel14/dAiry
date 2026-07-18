# 用户画像全量重建 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页新增"重新整理用户画像"：扫描工作区全部日记，按月正序逐轮 AI 迭代重建画像，全成功才写盘，支持实时进度与取消。

**Architecture:** 主进程新增 `electron/main/profile/profile-rebuild.ts`（扫描月份 → 逐月 `completeText` → 内存累积 → 完成后写盘 + `lastProfileRefresh`）；进度经回调 → IPC handler → `webContents.send` 推送；互斥标志放 `profile-service.ts`（rebuild 单向依赖 service，`runProfileMaintenance` 重建期间跳过）；preload 新增 3 个 API，画像内容仍不过 IPC。

**Tech Stack:** Electron 主进程（fs/promises + dayjs 不需要——月份扫描纯目录遍历）、Vue 3 设置页、TypeScript。无测试框架，验证 = `cmd /c "npm run typecheck"` + dev 冒烟。

**关联 spec:** `docs/superpowers/specs/2026-07-18-user-profile-rebuild-design.md`

---

## 与 spec 的微调（plan 层决策）

1. **UI 放独立卡片**：spec 8 节说"大模型配置卡片内"。实现改为在"大模型配置"与"补充知识"之间插入独立的"用户画像"settings-card——避免重建按钮与配置保存按钮在同一卡片内堆叠混淆，视觉顺序仍满足"两个下拉之后"。
2. **进度回调注入**：`rebuildUserProfile(input, onProgress?)` 通过回调上报进度，`webContents.send` 留在 IPC 层——rebuild 模块不依赖 `window.ts`。
3. **失败消息带月份**：单月 AI 调用失败时包装为"整理 YYYY-MM 失败：<原因>"，渲染层追加"现有画像未受影响。"。

## 约定提醒

- git 提交信息：**英文前缀 + 中文内容**
- npm 命令经 cmd：`cmd /c "npm run typecheck"`（workdir `D:\Project\Code\dAiry`）
- 不引入新依赖；不加注释（复杂逻辑处的必要中文注释除外，plan 代码块中已含的注释保留）
- 本项目无测试框架，不要引入 vitest/jest

---

### Task 1: 类型与 IPC channel 定义

**Files:**
- Modify: `src/types/ai.ts`
- Modify: `src/shared/ipc-channels.ts`

- [ ] **Step 1.1: `src/types/ai.ts` 文件末尾追加三个类型**

```typescript
export interface RebuildUserProfileInput {
  workspacePath: string
}

export interface RebuildUserProfileResult {
  status: 'completed' | 'cancelled'
  processedMonths: number
  totalMonths: number
}

export interface UserProfileRebuildProgress {
  month: string
  index: number
  total: number
}
```

- [ ] **Step 1.2: `src/shared/ipc-channels.ts` 在 `// report` 分组之前新增分组**

在 `generateDailyInsights: 'journal:generate-daily-insights',` 行之后插入：

```typescript
  // profile
  rebuildUserProfile: 'profile:rebuild-user-profile',
  cancelUserProfileRebuild: 'profile:cancel-user-profile-rebuild',
  userProfileRebuildProgress: 'profile:user-profile-rebuild-progress',
```

- [ ] **Step 1.3: typecheck**

Run: `cmd /c "npm run typecheck"`
Expected: 无错误。

- [ ] **Step 1.4: Commit**

```bash
git add src/types/ai.ts src/shared/ipc-channels.ts
git commit -m "feat: 新增画像重建的类型定义与 IPC channel"
```

---

### Task 2: 重建 System Prompt

**Files:**
- Create: `electron/main/ai/prompts/profile-rebuild.system.md`
- Modify: `electron/main/ai/prompt-loader.ts`

- [ ] **Step 2.1: 新建 `profile-rebuild.system.md`**

完整文件内容（逐字使用，UTF-8）：

```markdown
你是一个负责维护"用户画像"的助手。现在进行一次按时间顺序的画像重建：系统会把用户的全部历史日记按月依次交给你，每一轮你会收到"截至上月的画像"和"本月日记"，你需要把本月的信息融合进画像，输出新的完整画像。

你会收到两部分输入：

1. 截至上月的用户画像（第一个月时为空）。
2. 本月的日记列表（含日期、心情、摘要、正文）。

融合规则（累积原则）：

- 既有画像中的信息默认保留，不因"本月未提及"而删除长期信息。
- 本月日记提供新信息时补充进对应小节；与旧信息冲突时，以更新的日记为准。
- 只精简明显过时、已被后续事实取代的内容。
- 发现跨月延续的模式（反复出现的主题、习惯、情绪规律）时，可以在画像中沉淀为长期观察。
- 画像记录长期事实与模式，不要罗列逐日流水账。

画像框架如下（允许在框架内增删小节）：

# 用户画像

（由 AI 从日记中自动提取和维护）

## 身份与角色
## 日常习惯与作息
## 进行中的项目与关注话题
## 情绪模式
## 其他观察

内容要求：

- 如果当前画像为空，按上述框架创建初始画像；信息不足的小节可以只写"（暂无）"。
- 全文控制在 1500 字以内；当字数受限时，优先保留跨月稳定出现的信息与最新状态。
- 语言与日记主语言保持一致（通常为中文）。

事实与安全约束：

- 只能依据输入内容提炼，不要编造日记中没有出现的事实、人物、计划或偏好。
- 不要替用户做心理诊断，不要输出评价性、说教性内容。

输出约束：

- 只输出画像 Markdown 全文，输出内容的第一行必须是 `# 用户画像`，不要把它放进代码块。
- 不要输出任何解释、前言、结语。
```

- [ ] **Step 2.2: `prompt-loader.ts` 注册（保持字母序）**

`PROMPT_FILE_MAP` 改为：

```typescript
const PROMPT_FILE_MAP = {
  dailyOrganizeSystem: new URL('./prompts/daily-organize.system.md', import.meta.url),
  profileDailyUpdateSystem: new URL('./prompts/profile-daily-update.system.md', import.meta.url),
  profileFullRefreshSystem: new URL('./prompts/profile-full-refresh.system.md', import.meta.url),
  profileRebuildSystem: new URL('./prompts/profile-rebuild.system.md', import.meta.url),
  rangeReportSummaryFocusSystem: new URL('./prompts/range-report-summary-focus.system.md', import.meta.url),
  rangeReportSummarySystem: new URL('./prompts/range-report-summary.system.md', import.meta.url),
} as const
```

- [ ] **Step 2.3: typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add electron/main/ai/prompts/profile-rebuild.system.md electron/main/ai/prompt-loader.ts
git commit -m "feat: 新增画像重建 System Prompt 并注册加载"
```

---

### Task 3: profile-service 共享导出与重建互斥标志

**Files:**
- Modify: `electron/main/profile/profile-service.ts`

- [ ] **Step 3.1: 导出共享工具**

三处修改（函数体均不变，只加 `export`）：

1. `function normalizeProfileMarkdown(` → `export function normalizeProfileMarkdown(`
2. `async function createProfileAiClient(` → `export async function createProfileAiClient(`
3. `const PROFILE_AI_TEMPERATURE = 0.3` → `export const PROFILE_AI_TEMPERATURE = 0.3`

- [ ] **Step 3.2: 新增重建运行标志**

在 `const MAX_ENTRY_BODY_LENGTH = 2200` 之后插入：

```typescript
let isRebuildRunning = false

export function setProfileRebuildRunning(value: boolean) {
  isRebuildRunning = value
}

export function isProfileRebuildRunning() {
  return isRebuildRunning
}
```

- [ ] **Step 3.3: `runProfileMaintenance` 重建期间跳过**

在 `runProfileMaintenance` 的外层 `try {` 之后、`if (!input.workspacePath.trim() || !input.body.trim())` 之前插入：

```typescript
    if (isProfileRebuildRunning()) {
      return
    }
```

- [ ] **Step 3.4: typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add electron/main/profile/profile-service.ts
git commit -m "feat: 画像服务导出共享工具并支持重建互斥"
```

---

### Task 4: 重建核心模块 profile-rebuild.ts

**Files:**
- Create: `electron/main/profile/profile-rebuild.ts`
- Modify: `electron/main/profile/index.ts`

- [ ] **Step 4.1: 新建 `electron/main/profile/profile-rebuild.ts`**

完整文件内容：

```typescript
import path from 'node:path'
import { readdir } from 'node:fs/promises'
import type {
  RebuildUserProfileInput,
  RebuildUserProfileResult,
  UserProfileRebuildProgress,
} from '../../../src/types/ai'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { loadPrompt } from '../ai'
import { readJournalDocument } from '../journal/document'
import { getWorkspaceJournalDir, resolveJournalEntryFilePath } from '../workspace/paths'
import { updateWorkspaceConfig } from '../workspace/config'
import {
  PROFILE_AI_TEMPERATURE,
  createProfileAiClient,
  isProfileRebuildRunning,
  normalizeProfileMarkdown,
  setProfileRebuildRunning,
  writeUserProfile,
} from './profile-service'

const MONTH_BODY_BUDGET = 60000
const MAX_ENTRY_BODY_LENGTH = 2200

interface RebuildMonthEntry {
  date: string
  mood: number
  summary: string
  body: string
}

let isCancelRequested = false

export function cancelUserProfileRebuild() {
  if (isProfileRebuildRunning()) {
    isCancelRequested = true
  }
}

function truncateBody(body: string, maxLength: number) {
  const normalizedBody = body.trim()
  if (normalizedBody.length <= maxLength) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, maxLength)}...`
}

async function scanJournalMonths(workspacePath: string): Promise<Map<string, string[]>> {
  const journalDir = getWorkspaceJournalDir(workspacePath)
  const monthDates = new Map<string, string[]>()

  let yearEntries
  try {
    yearEntries = await readdir(journalDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return monthDates
    }

    throw error
  }

  for (const yearEntry of yearEntries) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) {
      continue
    }

    const monthEntries = await readdir(path.join(journalDir, yearEntry.name), {
      withFileTypes: true,
    })

    for (const monthEntry of monthEntries) {
      if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) {
        continue
      }

      const month = `${yearEntry.name}-${monthEntry.name}`
      const fileEntries = await readdir(path.join(journalDir, yearEntry.name, monthEntry.name), {
        withFileTypes: true,
      })
      const dates: string[] = []

      for (const fileEntry of fileEntries) {
        const fileMatch = fileEntry.isFile()
          ? fileEntry.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
          : null

        if (!fileMatch || !fileMatch[1].startsWith(month)) {
          continue
        }

        dates.push(fileMatch[1])
      }

      if (dates.length > 0) {
        monthDates.set(month, dates.sort())
      }
    }
  }

  return monthDates
}

async function collectMonthEntries(
  workspacePath: string,
  dates: string[],
): Promise<RebuildMonthEntry[]> {
  // 单月正文总量控制在预算内，篇数越多单篇截断越短
  const bodyLimit = Math.min(MAX_ENTRY_BODY_LENGTH, Math.floor(MONTH_BODY_BUDGET / dates.length))
  const entries: RebuildMonthEntry[] = []

  for (const date of dates) {
    try {
      const document = await readJournalDocument(resolveJournalEntryFilePath(workspacePath, date))

      entries.push({
        date,
        mood: document.frontmatter.mood,
        summary: document.frontmatter.summary,
        body: truncateBody(document.body, bodyLimit),
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      throw error
    }
  }

  return entries.filter((entry) => entry.body || entry.summary.trim())
}

function buildRebuildPrompt(input: {
  month: string
  index: number
  total: number
  profile: string
  entries: RebuildMonthEntry[]
}) {
  const entryBlocks = input.entries.map((entry) =>
    [
      '---',
      `日期: ${entry.date}`,
      `心情: ${entry.mood}`,
      `摘要: ${entry.summary || '（无）'}`,
      `正文:\n${entry.body || '（无）'}`,
    ].join('\n'),
  )

  return [
    `整理月份：${input.month}（第 ${input.index}/${input.total} 个月）`,
    `截至上月的用户画像：\n${input.profile.trim() || '（这是第一个月，画像从空开始）'}`,
    `本月日记：\n${entryBlocks.join('\n')}`,
  ].join('\n\n')
}

export async function rebuildUserProfile(
  input: RebuildUserProfileInput,
  onProgress?: (progress: UserProfileRebuildProgress) => void,
): Promise<RebuildUserProfileResult> {
  if (!input.workspacePath.trim()) {
    throw new Error('当前还没有可用的工作区。')
  }

  if (isProfileRebuildRunning()) {
    throw new Error('画像整理已在进行中。')
  }

  const config = await readAppConfig()
  const settings = normalizeAiSettings(config.ai)
  const client = await createProfileAiClient(settings)

  if (!client) {
    throw new Error('请先在设置页完成大模型配置和 API Key 保存。')
  }

  const monthDates = await scanJournalMonths(input.workspacePath)
  const months = [...monthDates.keys()].sort()

  if (months.length === 0) {
    throw new Error('当前工作区没有可用于整理的日记。')
  }

  setProfileRebuildRunning(true)
  isCancelRequested = false

  try {
    const systemPrompt = await loadPrompt('profileRebuildSystem')
    let profile = ''
    let processedMonths = 0

    for (const [monthIndex, month] of months.entries()) {
      if (isCancelRequested) {
        return { status: 'cancelled', processedMonths, totalMonths: months.length }
      }

      onProgress?.({ month, index: monthIndex + 1, total: months.length })

      const entries = await collectMonthEntries(input.workspacePath, monthDates.get(month) ?? [])
      if (entries.length === 0) {
        processedMonths += 1
        continue
      }

      let responseText: string
      try {
        responseText = await client.completeText({
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: buildRebuildPrompt({
                month,
                index: monthIndex + 1,
                total: months.length,
                profile,
                entries,
              }),
            },
          ],
          temperature: PROFILE_AI_TEMPERATURE,
        })
      } catch (error) {
        throw new Error(
          `整理 ${month} 失败：${error instanceof Error ? error.message : '未知错误'}`,
        )
      }

      const nextProfile = normalizeProfileMarkdown(responseText)
      if (!nextProfile) {
        throw new Error(`整理 ${month} 失败：AI 返回的画像内容为空。`)
      }

      profile = nextProfile
      processedMonths += 1
    }

    // 最后一轮调用返回后才收到取消请求的情况
    if (isCancelRequested) {
      return { status: 'cancelled', processedMonths, totalMonths: months.length }
    }

    if (!profile) {
      throw new Error('整理结束，但没有生成任何画像内容。')
    }

    await writeUserProfile(input.workspacePath, profile)
    await updateWorkspaceConfig(input.workspacePath, {
      lastProfileRefresh: new Date().toISOString(),
    })

    return { status: 'completed', processedMonths, totalMonths: months.length }
  } finally {
    setProfileRebuildRunning(false)
    isCancelRequested = false
  }
}
```

- [ ] **Step 4.2: `electron/main/profile/index.ts` 补导出**

整个文件替换为：

```typescript
export {
  readUserProfile,
  refreshUserProfileFull,
  runProfileMaintenance,
  shouldRunFullRefresh,
  updateUserProfileDaily,
  writeUserProfile,
} from './profile-service'
export { cancelUserProfileRebuild, rebuildUserProfile } from './profile-rebuild'
```

- [ ] **Step 4.3: typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add electron/main/profile/profile-rebuild.ts electron/main/profile/index.ts
git commit -m "feat: 新增画像全量重建服务，按月迭代且全成功才写盘"
```

---

### Task 5: IPC handler、preload 与 API 类型

**Files:**
- Create: `electron/main/ipc/profile.ts`
- Modify: `electron/main/ipc/index.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 5.1: 新建 `electron/main/ipc/profile.ts`**

完整文件内容：

```typescript
import { ipcMain } from 'electron'
import type { RebuildUserProfileInput } from '../../../src/types/ai'
import { IPC_CHANNELS } from '../constants'
import { cancelUserProfileRebuild, rebuildUserProfile } from '../profile'
import { getMainWindow } from '../window'

export function registerProfileIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.rebuildUserProfile, (_event, input: RebuildUserProfileInput) => {
    return rebuildUserProfile(input, (progress) => {
      const win = getMainWindow()
      if (!win || win.isDestroyed()) {
        return
      }

      win.webContents.send(IPC_CHANNELS.userProfileRebuildProgress, progress)
    })
  })

  ipcMain.handle(IPC_CHANNELS.cancelUserProfileRebuild, () => {
    cancelUserProfileRebuild()
  })
}
```

- [ ] **Step 5.2: `electron/main/ipc/index.ts` 注册**

整个文件替换为：

```typescript
import { registerAppIpcHandlers } from './app'
import { registerJournalIpcHandlers } from './journal'
import { registerProfileIpcHandlers } from './profile'
import { registerReportIpcHandlers } from './report'
import { registerWorkspaceIpcHandlers } from './workspace'

export function registerIpcHandlers() {
  registerAppIpcHandlers()
  registerWorkspaceIpcHandlers()
  registerJournalIpcHandlers()
  registerProfileIpcHandlers()
  registerReportIpcHandlers()
}
```

- [ ] **Step 5.3: `src/types/api.ts` 扩展 `DairyApi`**

import 区的 `from './ai'` 列表补三个类型（保持字母序）：

```typescript
import type {
  AiContextDocument,
  AiSettingsStatus,
  GenerateDailyInsightsInput,
  GenerateDailyInsightsResult,
  RebuildUserProfileInput,
  RebuildUserProfileResult,
  SaveAiApiKeyInput,
  SaveAiContextInput,
  SaveAiSettingsInput,
  UserProfileRebuildProgress,
} from './ai'
```

`DairyApi` 接口在 `generateDailyInsights` 成员之后插入：

```typescript
  rebuildUserProfile: (input: RebuildUserProfileInput) => Promise<RebuildUserProfileResult>
  cancelUserProfileRebuild: () => Promise<void>
  onUserProfileRebuildProgress: (
    listener: (progress: UserProfileRebuildProgress) => void,
  ) => () => void
```

- [ ] **Step 5.4: `electron/preload.ts` 实现三个 API**

在 `generateDailyInsights: ...` 行之后插入：

```typescript
  rebuildUserProfile: (input) => ipcRenderer.invoke(IPC_CHANNELS.rebuildUserProfile, input),
  cancelUserProfileRebuild: () => ipcRenderer.invoke(IPC_CHANNELS.cancelUserProfileRebuild),
  onUserProfileRebuildProgress: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { month?: unknown; index?: unknown; total?: unknown } | undefined,
    ) => {
      if (
        typeof payload?.month === 'string' &&
        typeof payload?.index === 'number' &&
        typeof payload?.total === 'number'
      ) {
        listener({ month: payload.month, index: payload.index, total: payload.total })
      }
    }

    ipcRenderer.on(IPC_CHANNELS.userProfileRebuildProgress, wrappedListener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.userProfileRebuildProgress, wrappedListener)
    }
  },
```

- [ ] **Step 5.5: typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add electron/main/ipc/profile.ts electron/main/ipc/index.ts electron/preload.ts src/types/api.ts
git commit -m "feat: 打通画像重建的 IPC 与 preload 通道"
```

---

### Task 6: 前端状态、composable 与设置页 UI

**Files:**
- Modify: `src/app/composables/app-shell/state.ts`
- Modify: `src/app/composables/app-shell/ai.ts`
- Modify: `src/app/composables/useAppShell.ts`
- Modify: `src/components/settings/sections/SettingsAiSection.vue`
- Modify: `src/components/settings/panel/SettingsPanel.vue`
- Modify: `src/app/pages/AppShellPage.vue`

- [ ] **Step 6.1: `state.ts` 新增状态**

import 区 `from '../../../types/ai'` 补 `UserProfileRebuildProgress`：

```typescript
import type { AiContextDocument, AiSettingsStatus, UserProfileRebuildProgress } from '../../../types/ai'
```

`useAppShellState` 中 `const isSavingAiContext = ref(false)` 之后新增四个 ref：

```typescript
  const isRebuildingProfile = ref(false)
  const isCancellingProfileRebuild = ref(false)
  const profileRebuildProgress = ref<UserProfileRebuildProgress | null>(null)
  const profileRebuildMessage = ref('')
```

return 对象中按字母序插入四个名字（`isRebuildingProfile` 插在 `isJournalReady` 之后附近、`isCancellingProfileRebuild` 插在 `isCreatingEntry` 之后附近、`profileRebuildMessage` / `profileRebuildProgress` 插在 `notificationSaveMessage` 之后附近；位置只需大致有序，保证四个都在即可）。

- [ ] **Step 6.2: `ai.ts` composable 新增两个 handler**

在 `handleSaveAiContext` 函数之后新增：

```typescript
  async function handleRebuildUserProfile() {
    if (state.isRebuildingProfile.value) {
      return
    }

    if (!state.workspacePath.value) {
      state.profileRebuildMessage.value = '请先选择工作区。'
      return
    }

    const confirmed = window.confirm(
      '将扫描当前工作区的全部日记，按月重新构建用户画像（每个有日记的月份消耗一轮 AI 调用，token 消耗较大）。整理完成前现有画像保持不变，是否继续？',
    )
    if (!confirmed) {
      return
    }

    state.isRebuildingProfile.value = true
    state.isCancellingProfileRebuild.value = false
    state.profileRebuildProgress.value = null
    state.profileRebuildMessage.value = ''

    try {
      const result = await window.dairy.rebuildUserProfile({
        workspacePath: `${state.workspacePath.value}`,
      })

      state.profileRebuildMessage.value =
        result.status === 'completed'
          ? `画像整理完成（共 ${result.totalMonths} 个月）。`
          : '已取消，现有画像未受影响。'
    } catch (error) {
      state.profileRebuildMessage.value = `${
        error instanceof Error ? error.message : '画像整理失败，请稍后重试。'
      }现有画像未受影响。`
    } finally {
      state.isRebuildingProfile.value = false
      state.isCancellingProfileRebuild.value = false
      state.profileRebuildProgress.value = null
    }
  }

  async function handleCancelUserProfileRebuild() {
    if (!state.isRebuildingProfile.value || state.isCancellingProfileRebuild.value) {
      return
    }

    state.isCancellingProfileRebuild.value = true

    try {
      await window.dairy.cancelUserProfileRebuild()
    } catch {
      state.isCancellingProfileRebuild.value = false
    }
  }
```

return 对象补两个名字：

```typescript
  return {
    handleSaveAiConfiguration,
    handleSaveAiContext,
    handleRebuildUserProfile,
    handleCancelUserProfileRebuild,
  }
```

- [ ] **Step 6.3: `useAppShell.ts` 订阅进度事件**

监听器变量声明区（`let removeSystemThemeListener` 之后）新增：

```typescript
  let removeProfileRebuildProgressListener: (() => void) | null = null
```

`onMounted` 中 `removeMainPanelNavigationListener = ...` 之后新增：

```typescript
    removeProfileRebuildProgressListener = window.dairy.onUserProfileRebuildProgress(
      (progress) => {
        state.profileRebuildProgress.value = progress
      },
    )
```

`onBeforeUnmount` 中对应清理（`removeMainPanelNavigationListener` 清理之后）：

```typescript
    removeProfileRebuildProgressListener?.()
    removeProfileRebuildProgressListener = null
```

- [ ] **Step 6.4: `SettingsAiSection.vue` 新增"用户画像"卡片**

script 区改动：

1. import 类型补 `UserProfileRebuildProgress`：

```typescript
import type {
  AiContextDocument,
  AiProviderType,
  AiSettings,
  AiSettingsStatus,
  UserProfileRebuildProgress,
} from '../../../types/ai'
```

2. `defineProps` 补五个 props（追加在 `aiContextSaveMessage: string` 之后）：

```typescript
  workspacePath: string | null
  isRebuildingProfile: boolean
  isCancellingProfileRebuild: boolean
  profileRebuildProgress: UserProfileRebuildProgress | null
  profileRebuildMessage: string
```

3. `defineEmits` 补两个事件（追加在 `saveAiContext: [value: string]` 之后）：

```typescript
  rebuildUserProfile: []
  cancelUserProfileRebuild: []
```

4. 在 `isViewingSavedProvider` computed 之后新增两个 computed：

```typescript
const canRebuildProfile = computed(() => {
  return (
    Boolean(props.workspacePath) &&
    props.aiSettingsStatus.isConfigured &&
    !props.isRebuildingProfile
  )
})

const rebuildProgressText = computed(() => {
  if (!props.profileRebuildProgress) {
    return '正在准备整理'
  }

  const { month, index, total } = props.profileRebuildProgress
  return `正在整理 ${month}（${index}/${total}）`
})
```

模板改动：在"大模型配置"卡片（第一个 `</section>`）与"补充知识"卡片之间插入：

```html
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">用户画像</span>
      </div>

      <div class="workspace-summary">
        <div class="workspace-summary-copy">
          <p class="panel-description">
            扫描当前工作区的全部历史日记，按月重新构建用户画像，适合老用户首次启用画像或画像质量退化时使用。整理完成前现有画像保持不变。
          </p>
        </div>
      </div>

      <div class="library-actions">
        <button
          v-if="!isRebuildingProfile"
          class="save-button"
          type="button"
          :disabled="!canRebuildProfile"
          @click="emit('rebuildUserProfile')"
        >
          重新整理用户画像
        </button>
        <template v-else>
          <span class="setting-feedback">{{ rebuildProgressText }}</span>
          <button
            class="save-button"
            type="button"
            :disabled="isCancellingProfileRebuild"
            @click="emit('cancelUserProfileRebuild')"
          >
            {{ isCancellingProfileRebuild ? '正在取消' : '取消' }}
          </button>
        </template>
      </div>

      <p v-if="profileRebuildMessage" class="setting-feedback">
        {{ profileRebuildMessage }}
      </p>
    </section>
```

- [ ] **Step 6.5: `SettingsPanel.vue` 透传**

`defineProps` 补五个（追加在 `aiContextSaveMessage: string` 之后）：

```typescript
  isRebuildingProfile: boolean
  isCancellingProfileRebuild: boolean
  profileRebuildProgress: UserProfileRebuildProgress | null
  profileRebuildMessage: string
```

（`workspacePath` 已有，无需新增。）import 类型行补 `UserProfileRebuildProgress`：

```typescript
import type { AiContextDocument, AiSettings, AiSettingsStatus, UserProfileRebuildProgress } from '../../../types/ai'
```

`defineEmits` 补：

```typescript
  rebuildUserProfile: []
  cancelUserProfileRebuild: []
```

模板中 `SettingsAiSection` 的绑定补：

```html
        :workspace-path="props.workspacePath"
        :is-rebuilding-profile="props.isRebuildingProfile"
        :is-cancelling-profile-rebuild="props.isCancellingProfileRebuild"
        :profile-rebuild-progress="props.profileRebuildProgress"
        :profile-rebuild-message="props.profileRebuildMessage"
        @rebuild-user-profile="emit('rebuildUserProfile')"
        @cancel-user-profile-rebuild="emit('cancelUserProfileRebuild')"
```

- [ ] **Step 6.6: `AppShellPage.vue` 绑定**

`useAppShell()` 解构补四个状态与两个 handler（按字母序插入）：

```typescript
  handleCancelUserProfileRebuild,
  handleRebuildUserProfile,
  isCancellingProfileRebuild,
  isRebuildingProfile,
  profileRebuildMessage,
  profileRebuildProgress,
```

模板 `SettingsPanel` 绑定补：

```html
        :is-rebuilding-profile="isRebuildingProfile"
        :is-cancelling-profile-rebuild="isCancellingProfileRebuild"
        :profile-rebuild-progress="profileRebuildProgress"
        :profile-rebuild-message="profileRebuildMessage"
        @rebuild-user-profile="handleRebuildUserProfile"
        @cancel-user-profile-rebuild="handleCancelUserProfileRebuild"
```

- [ ] **Step 6.7: typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add src/app/composables/app-shell/state.ts src/app/composables/app-shell/ai.ts src/app/composables/useAppShell.ts src/components/settings/sections/SettingsAiSection.vue src/components/settings/panel/SettingsPanel.vue src/app/pages/AppShellPage.vue
git commit -m "feat: 设置页新增用户画像重建入口与进度展示"
```

---

### Task 7: AGENTS.md 约定更新与冒烟清单

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 7.1: 更新 AGENTS.md**

第 6 节 AI 约束列表末尾（上次新增的"AI 自动维护 … 报告链路补做 insight 不触发画像"那一条之后）追加一条：

```markdown
- 设置页提供"重新整理用户画像"：扫描全部日记按月迭代重建画像，全成功才写盘并更新 `lastProfileRefresh`；重建期间自动画像维护跳过；preload 暴露重建/取消/进度三个 API，但画像内容仍不经过 IPC
```

- [ ] **Step 7.2: 最终 typecheck + Commit**

Run: `cmd /c "npm run typecheck"` → 无错误。

```bash
git add AGENTS.md
git commit -m "docs: 补充画像重建功能的稳定约定"
```

- [ ] **Step 7.3: 人工冒烟清单（交给用户，需真实 AI Key）**

1. 设置页 → 大模型：出现"用户画像"卡片；无工作区或 AI 未配置时按钮禁用
2. 点按钮 → 出现 confirm → 取消 confirm 无任何变化
3. 确认后：进度文本逐月推进（"正在整理 YYYY-MM（x/y）"），期间可切到写作页正常编辑
4. 完成后：提示"画像整理完成（共 N 个月）。"；检查 `.dairy/user-profile.md` 内容覆盖了早期历史；`workspace.json` 的 `lastProfileRefresh` 已更新
5. 重建期间点"自动整理"：日总结正常返回；主进程无画像写入冲突（user-profile.md 修改时间不因自动整理变化）
6. 再次发起重建并中途点取消：按钮变"正在取消"，最多等一轮调用后提示"已取消，现有画像未受影响。"，画像文件内容与重建前一致
7. 断网后发起：在某月失败，提示"整理 YYYY-MM 失败：…现有画像未受影响。"，画像文件未变

---

## 完成标准

- `cmd /c "npm run typecheck"` 全绿
- 7 项冒烟全部通过
- 提交信息全部符合"英文前缀+中文"格式
