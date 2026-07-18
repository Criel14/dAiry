# 项目结构优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除代码库中的定义重复、提升目录组织的一致性、搭建基础类型检查流程，使新增功能和配置项的成本与出错概率显著降低。

**Architecture:** 本计划分三批独立执行——Batch 1 是纯文件移动和删除（零行为变化），Batch 2 是 IPC 通道共享和 ipc.ts 按域拆分（小范围 import 调整），Batch 3 是 settings 状态下沉和通用 `useSaveOperation` 抽取（渲染进程内部重构）。每批完成后可独立验证。

**Tech Stack:** TypeScript, Electron, Vue 3 组合式 API

---

## Batch 1：机械性清理与目录聚合（零行为变化）

### Task 1: 添加独立 typecheck 脚本

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 `package.json` 添加 typecheck 脚本**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build && electron-builder",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

- [ ] **Step 2: 运行 typecheck 确认基线通过**

```bash
cmd /c npm run typecheck
```

Expected: 退出码 0，无类型错误。

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add independent typecheck script"
```

---

### Task 2: 删除死文件 `src/types/dairy.ts`

**Files:**
- Delete: `src/types/dairy.ts`

- [ ] **Step 1: 确认零引用后删除**

全仓库搜索已确认（Task 之前的 grep 结果）：`dairy.ts` export `* from './index'`，但没有任何文件 import 它。

```bash
git rm src/types/dairy.ts
```

- [ ] **Step 2: 运行 typecheck 验证**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete unused src/types/dairy.ts"
```

---

### Task 3: 拆分 `electron/main/constants.ts`——提取 IPC 通道到共享模块

**Files:**
- Create: `src/shared/ipc-channels.ts`
- Modify: `electron/main/constants.ts:25-68`（移除 IPC_CHANNELS 定义块）
- Modify: `electron/preload.ts`（用 import 替换硬编码字符串）

**说明：** `preload.ts` 目前每个通道名都是自由字符串，和 `IPC_CHANNELS` 双份手写维护。因为 `preload.ts` 通过 `contextBridge` 暴露 API，属于 preload 编译单元，不能直接 import `electron/main/constants.ts`（该文件 import 了 `electron` 模块且在 `electron/main` 目录下），但可以 import `src/shared/` 下的纯 TS 文件。

- [ ] **Step 1: 创建 `src/shared/ipc-channels.ts`**

```typescript
export const IPC_CHANNELS = {
  // app
  getBootstrap: 'app:get-bootstrap',
  getThemePreference: 'app:get-theme-preference',
  getAiSettingsStatus: 'app:get-ai-settings-status',
  saveAiSettings: 'app:save-ai-settings',
  saveAiApiKey: 'app:save-ai-api-key',
  getAiContext: 'app:get-ai-context',
  saveAiContext: 'app:save-ai-context',
  setThemePreference: 'app:set-theme-preference',
  setWindowZoomFactor: 'app:set-window-zoom-factor',
  windowZoomChanged: 'app:window-zoom-changed',
  navigateMainPanel: 'app:navigate-main-panel',
  setJournalHeatmapEnabled: 'app:set-journal-heatmap-enabled',
  setDayStartHour: 'app:set-day-start-hour',
  setWindowCloseBehavior: 'app:set-window-close-behavior',
  setLaunchOnStartupPreference: 'app:set-launch-on-startup-preference',
  setNotificationPreference: 'app:set-notification-preference',
  getEmailNotificationStatus: 'app:get-email-notification-status',
  saveEmailNotificationAuthCode: 'app:save-email-notification-auth-code',
  setFrontmatterVisibility: 'app:set-frontmatter-visibility',
  setWindowDirtyState: 'app:set-window-dirty-state',
  openExternalLink: 'app:open-external-link',
  openDevTools: 'app:open-dev-tools',
  // workspace
  chooseWorkspace: 'workspace:choose',
  openWorkspaceFolder: 'workspace:open-folder',
  getWorkspaceTags: 'workspace:get-tags',
  getWorkspaceWeatherOptions: 'workspace:get-weather-options',
  getWorkspaceLocationOptions: 'workspace:get-location-options',
  setWorkspaceTags: 'workspace:set-tags',
  setWorkspaceWeatherOptions: 'workspace:set-weather-options',
  setWorkspaceLocationOptions: 'workspace:set-location-options',
  // journal
  readJournalEntry: 'journal:read-entry',
  createJournalEntry: 'journal:create-entry',
  saveJournalEntryBody: 'journal:save-entry-body',
  saveJournalEntryMetadata: 'journal:save-entry-metadata',
  getJournalMonthActivity: 'journal:get-month-activity',
  generateDailyInsights: 'journal:generate-daily-insights',
  // report
  generateRangeReport: 'report:generate-range-report',
  getRangeReport: 'report:get-range-report',
  listRangeReports: 'report:list-range-reports',
  exportRangeReportPng: 'report:export-png',
  getReportExportPayload: 'report:get-export-payload',
  notifyReportExportReady: 'report:export-ready',
} as const
```

- [ ] **Step 2: 修改 `electron/preload.ts`——用 import 替代所有硬编码 channel 字符串**

将 preload.ts 中所有 `ipcRenderer.invoke('app:xxx', ...)` 替换为 `ipcRenderer.invoke(IPC_CHANNELS.xxx, ...)`。顶部添加 import：

```typescript
import { IPC_CHANNELS } from '../src/shared/ipc-channels'
```

完整新版 preload.ts 如下：

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { DairyApi } from '../src/types/api'
import type { RightPanel } from '../src/types/ui'
import { IPC_CHANNELS } from '../src/shared/ipc-channels'

const dairyApi: DairyApi = {
  getAppBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.getBootstrap),
  getThemePreference: () => ipcRenderer.invoke(IPC_CHANNELS.getThemePreference),
  getAiSettingsStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getAiSettingsStatus),
  setThemePreference: (input) => ipcRenderer.invoke(IPC_CHANNELS.setThemePreference, input),
  setWindowZoomFactor: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowZoomFactor, input),
  onWindowZoomFactorChanged: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { zoomFactor?: unknown } | undefined,
    ) => {
      if (typeof payload?.zoomFactor === 'number') {
        listener(payload.zoomFactor)
      }
    }
    ipcRenderer.on(IPC_CHANNELS.windowZoomChanged, wrappedListener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowZoomChanged, wrappedListener)
    }
  },
  onNavigateMainPanel: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { panel?: unknown } | undefined,
    ) => {
      const panel = payload?.panel
      if (panel === 'journal' || panel === 'reports' || panel === 'settings') {
        listener(panel as RightPanel)
      }
    }
    ipcRenderer.on(IPC_CHANNELS.navigateMainPanel, wrappedListener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.navigateMainPanel, wrappedListener)
    }
  },
  saveAiSettings: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveAiSettings, input),
  saveAiApiKey: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveAiApiKey, input),
  getAiContext: () => ipcRenderer.invoke(IPC_CHANNELS.getAiContext),
  saveAiContext: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveAiContext, input),
  chooseWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.chooseWorkspace),
  openWorkspaceFolder: (input) => ipcRenderer.invoke(IPC_CHANNELS.openWorkspaceFolder, input),
  readJournalEntry: (input) => ipcRenderer.invoke(IPC_CHANNELS.readJournalEntry, input),
  createJournalEntry: (input) => ipcRenderer.invoke(IPC_CHANNELS.createJournalEntry, input),
  saveJournalEntryBody: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveJournalEntryBody, input),
  saveJournalEntryMetadata: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveJournalEntryMetadata, input),
  getJournalMonthActivity: (input) => ipcRenderer.invoke(IPC_CHANNELS.getJournalMonthActivity, input),
  generateDailyInsights: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateDailyInsights, input),
  generateRangeReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.generateRangeReport, input),
  getRangeReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.getRangeReport, input),
  listRangeReports: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.listRangeReports, workspacePath),
  exportRangeReportPng: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportRangeReportPng, input),
  getReportExportPayload: (input) => ipcRenderer.invoke(IPC_CHANNELS.getReportExportPayload, input),
  notifyReportExportReady: (input) => ipcRenderer.invoke(IPC_CHANNELS.notifyReportExportReady, input),
  getWorkspaceTags: (workspacePath) => ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceTags, workspacePath),
  getWorkspaceWeatherOptions: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceWeatherOptions, workspacePath),
  getWorkspaceLocationOptions: (workspacePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkspaceLocationOptions, workspacePath),
  setWorkspaceTags: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceTags, input),
  setWorkspaceWeatherOptions: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceWeatherOptions, input),
  setWorkspaceLocationOptions: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWorkspaceLocationOptions, input),
  setJournalHeatmapEnabled: (input) => ipcRenderer.invoke(IPC_CHANNELS.setJournalHeatmapEnabled, input),
  setDayStartHour: (input) => ipcRenderer.invoke(IPC_CHANNELS.setDayStartHour, input),
  setWindowCloseBehavior: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowCloseBehavior, input),
  setLaunchOnStartupPreference: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.setLaunchOnStartupPreference, input),
  setNotificationPreference: (input) => ipcRenderer.invoke(IPC_CHANNELS.setNotificationPreference, input),
  getEmailNotificationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getEmailNotificationStatus),
  saveEmailNotificationAuthCode: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveEmailNotificationAuthCode, input),
  setFrontmatterVisibility: (input) => ipcRenderer.invoke(IPC_CHANNELS.setFrontmatterVisibility, input),
  setWindowDirtyState: (input) => ipcRenderer.invoke(IPC_CHANNELS.setWindowDirtyState, input),
  openExternalLink: (input) => ipcRenderer.invoke(IPC_CHANNELS.openExternalLink, input),
  openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.openDevTools),
}

contextBridge.exposeInMainWorld('dairy', dairyApi)
```

- [ ] **Step 3: 修改 `electron/main/constants.ts`——移除 `IPC_CHANNELS` 定义，改为从 `src/shared/ipc-channels` re-export**

删除 `constants.ts` 第 25-68 行的 `IPC_CHANNELS` 对象定义，在文件顶部添加 re-export：

```typescript
export { IPC_CHANNELS } from '../../src/shared/ipc-channels'
```

其他所有现有 import `{ IPC_CHANNELS } from './constants'` 的模块（`ipc.ts`、`window.ts`）无需改动，因为它们从 `constants.ts` 获取 IPC_CHANNELS 的路径不变。

- [ ] **Step 4: 运行 typecheck 验证**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels.ts electron/preload.ts electron/main/constants.ts
git commit -m "refactor: move IPC_CHANNELS to shared module, eliminate preload hardcoded strings"
```

---

### Task 4: 拆分 `electron/main/constants.ts`——提取默认配置到共享模块

**Files:**
- Create: `src/shared/defaults.ts`
- Modify: `electron/main/constants.ts:70-130`（移除 DEFAULT_* 定义，改为 re-export）
- Modify: `src/app/composables/app-shell/state.ts`（createDefault* 函数改用 shared 源）
- Modify: `electron/main/app-config.ts`（UPDATE import）

**说明：** 默认值目前在主进程 constants 和渲染进程 state.ts 各维护一份。将所有默认值集中到 `src/shared/defaults.ts`，两端 import 同一份。

- [ ] **Step 1: 创建 `src/shared/defaults.ts`**

```typescript
import type { AiSettings } from '../types/ai'
import type {
  AppConfig,
  EmailNotificationConfig,
  NotificationConfig,
  FrontmatterVisibilityConfig,
} from '../types/app'
import type { JournalEntryMetadata } from '../types/journal'
import { DEFAULT_WINDOW_ZOOM_FACTOR } from './window-zoom'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  providerType: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  timeoutMs: 30_000,
}

export const DEFAULT_EMAIL_NOTIFICATION_CONFIG: EmailNotificationConfig = {
  providerType: 'qq',
  smtpHost: 'smtp.qq.com',
  smtpPort: 465,
  encryption: 'ssl',
  username: '',
  fromEmail: '',
  recipientEmail: '',
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  systemEnabled: false,
  emailEnabled: false,
  reminderTime: '21:30',
  email: DEFAULT_EMAIL_NOTIFICATION_CONFIG,
}

export function createDefaultAppConfig(): AppConfig {
  return {
    lastOpenedWorkspace: null,
    recentWorkspaces: [],
    reportExport: {
      lastDirectory: null,
    },
    ui: {
      theme: 'system',
      zoomFactor: DEFAULT_WINDOW_ZOOM_FACTOR,
      journalHeatmapEnabled: false,
      dayStartHour: 0,
      closeBehavior: 'tray',
      launchOnStartup: true,
      notification: DEFAULT_NOTIFICATION_CONFIG,
      windowState: {
        bounds: null,
        isMaximized: false,
        isFullScreen: false,
      },
      frontmatterVisibility: {
        weather: true,
        location: true,
        mood: true,
        summary: true,
        tags: true,
      },
    },
    ai: DEFAULT_AI_SETTINGS,
  }
}

export const DEFAULT_APP_CONFIG = createDefaultAppConfig()

export const EMPTY_METADATA: JournalEntryMetadata = {
  weather: '',
  location: '',
  mood: 0,
  summary: '',
  tags: [],
}

export function createDefaultFrontmatterVisibility(): FrontmatterVisibilityConfig {
  return {
    weather: true,
    location: true,
    mood: true,
    summary: true,
    tags: true,
  }
}

export function createDefaultNotificationConfig(): NotificationConfig {
  return {
    systemEnabled: false,
    emailEnabled: false,
    reminderTime: '21:30',
    email: {
      providerType: 'qq',
      smtpHost: 'smtp.qq.com',
      smtpPort: 465,
      encryption: 'ssl',
      username: '',
      fromEmail: '',
      recipientEmail: '',
    },
  }
}

export const DEFAULT_WEATHER_OPTIONS = [
  '晴',
  '多云',
  '阴',
  '小雨',
  '大雨',
  '雷阵雨',
  '小雪',
  '大雪',
  '雾',
]

export const DEFAULT_LOCATION_OPTIONS = ['学校', '公司', '家']

export const DEFAULT_TAG_OPTIONS = ['上班', '加班', '原神', '杀戮尖塔']
```

- [ ] **Step 2: 修改 `electron/main/constants.ts`——移除默认值定义，改为 re-export**

删除第 70-146 行的 `DEFAULT_AI_SETTINGS`、`DEFAULT_EMAIL_NOTIFICATION_CONFIG`、`DEFAULT_NOTIFICATION_CONFIG`、`DEFAULT_APP_CONFIG`、`EMPTY_METADATA`、`DEFAULT_WEATHER_OPTIONS`、`DEFAULT_LOCATION_OPTIONS`、`DEFAULT_TAG_OPTIONS` 的定义。在文件底部添加：

```typescript
export {
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_CONFIG,
  DEFAULT_EMAIL_NOTIFICATION_CONFIG,
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_WEATHER_OPTIONS,
  DEFAULT_TAG_OPTIONS,
  EMPTY_METADATA,
} from '../../src/shared/defaults'
```

同时删除 constants.ts 顶部不再需要的 import：

```typescript
// 删除这行：
import type { AiSettings } from '../../src/types/ai'
```

`DEFAULT_WINDOW_ZOOM_FACTOR` 的 import 保留不动（constants.ts 仍需要它构造 `DEFAULT_APP_CONFIG`）——不对，`DEFAULT_APP_CONFIG` 现在从 `defaults.ts` export，而 `defaults.ts` 内部引用 `DEFAULT_WINDOW_ZOOM_FACTOR`。所以 constants.ts 不再需要 `DEFAULT_WINDOW_ZOOM_FACTOR` 的 import。将第 6 行：

```typescript
import { DEFAULT_WINDOW_ZOOM_FACTOR } from '../../src/shared/window-zoom'
```

一行删除。

- [ ] **Step 3: 修改 `src/app/composables/app-shell/state.ts`——createDefault* 函数改用 shared 源**

删除 `state.ts` 中的 `createDefaultFrontmatterVisibility`、`createDefaultNotificationConfig`、`createEmptyMetadata`、`createDefaultAiSettingsStatus`、`createDefaultAiContextDocument`、`createDefaultEmailNotificationStatus`、`createDefaultLaunchOnStartupPreference` 函数定义。

改为从 `src/shared/defaults.ts` import 并导出别名：

```typescript
// 在 state.ts 顶部添加/替换 imports
import {
  createDefaultFrontmatterVisibility,
  createDefaultNotificationConfig,
  EMPTY_METADATA,
  DEFAULT_AI_SETTINGS,
} from '../../../shared/defaults'
import type { AiContextDocument } from '../../../types/ai'
import type { EmailNotificationSecretStatus } from '../../../types/app'

export function createEmptyMetadata(): JournalEntryMetadata {
  return { ...EMPTY_METADATA, tags: [] }
}

export function createDefaultAiSettingsStatus(): AiSettingsStatus {
  return {
    settings: { ...DEFAULT_AI_SETTINGS },
    hasApiKey: false,
    isConfigured: false,
  }
}

export function createDefaultAiContextDocument(): AiContextDocument {
  return {
    content: '',
  }
}

export function createDefaultEmailNotificationStatus(): EmailNotificationSecretStatus {
  return {
    hasAuthCode: false,
    isConfigured: false,
  }
}

export function createDefaultLaunchOnStartupPreference() {
  return true
}
```

`state.ts` 中的 `createDefaultFrontmatterVisibility` 和 `createDefaultNotificationConfig` 直接改为从 `shared/defaults.ts` import 并 re-export：

```typescript
export { createDefaultFrontmatterVisibility } from '../../../shared/defaults'
```

`createDefaultNotificationConfig` 在 `state.ts` 中可删除（因为 state.ts 中 `notification` ref 的初始化改用 shared 版本）：

将第 201 行：
```typescript
const notification = ref<NotificationConfig>(createDefaultNotificationConfig())
```

替换为：
```typescript
import { createDefaultNotificationConfig } from '../../../shared/defaults'
const notification = ref<NotificationConfig>(createDefaultNotificationConfig())
```

- [ ] **Step 4: 运行 typecheck 验证**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/shared/defaults.ts electron/main/constants.ts src/app/composables/app-shell/state.ts
git commit -m "refactor: unify defaults into src/shared/defaults.ts, eliminate double maintenance"
```

---

### Task 5: `electron/main/` 域目录聚合——AI

**Files:**
- Move: `electron/main/ai-config.ts` → `electron/main/ai/config.ts`
- Move: `electron/main/ai-context.ts` → `electron/main/ai/context.ts`
- Move: `electron/main/ai-secrets.ts` → `electron/main/secrets.ts`
- Modify: `electron/main/ipc.ts`（UPDATE import paths）
- Modify: `electron/main/ai/journal-ai-service.ts`（UPDATE import paths）
- Modify: `electron/main/ai/report-ai-service.ts`（UPDATE import paths）
- Modify: `electron/main/notification.ts`（UPDATE import paths）

**说明：** `ai/` 目录已存在（含 `journal-ai-service.ts`、`report-ai-service.ts` 等），将 `electron/main/` 顶层的 `ai-config.ts`、`ai-context.ts` 并入。`ai-secrets.ts` 更名 `secrets.ts`（它同时管 AI key 和邮箱授权码，原名 mislead）。

- [ ] **Step 1: 移动文件并修改内部相对路径**

用 Git 移动文件（保留历史）：

```bash
git mv electron/main/ai-config.ts electron/main/ai/config.ts
git mv electron/main/ai-context.ts electron/main/ai/context.ts
git mv electron/main/ai-secrets.ts electron/main/secrets.ts
```

在 `electron/main/ai/config.ts` 中，将 `from './ai-secrets'` 改为 `from '../secrets'`.

在 `electron/main/ai/context.ts` 中，无相对 import 调整（只 import types）。

在 `electron/main/secrets.ts` 中，将 `from './app-config'` 改为 `from './app-config'`（仍在 `electron/main/` 下，路径不变——确认：`secrets.ts` 现在在 `electron/main/` 顶层，`app-config.ts` 也在 `electron/main/` 顶层，相对路径仍是 `./app-config`，不用改）。

在 `electron/main/ai/journal-ai-service.ts` 中：
- 第 6 行 `from '../workspace-paths'` → `from '../workspace-paths'`（secrets 还在 main/，没变）
- 第 8 行 `from '../ai-context'` → `from './context'`
- 第 9 行 `from '../ai-secrets'` → `from '../secrets'`
- 第 10 行 `from '../journal-document'` 不变（等 Task 6 改）

在 `electron/main/ai/report-ai-service.ts` 中：
- 第 9 行 `from '../ai-context'` → `from './context'`
- 第 10 行 `from '../ai-secrets'` → `from '../secrets'`

- [ ] **Step 2: 修改 `electron/main/ipc.ts`——UPDATE import paths**

将第 52-58 行：
```typescript
import { getAiSettingsStatus, saveAiSettings } from './ai-config'
import { getAiContextDocument, saveAiContext } from './ai-context'
import { ... } from './ai-secrets'
```

改为：
```typescript
import { getAiSettingsStatus, saveAiSettings } from './ai/config'
import { getAiContextDocument, saveAiContext } from './ai/context'
import { ... } from './secrets'
```

- [ ] **Step 3: 修改 `electron/main/notification.ts`——UPDATE import path**

将第 5 行 `from './ai-secrets'` 改为 `from './secrets'`.

- [ ] **Step 4: 修改 `electron/main/ai/config.ts`——UPDATE import path (ai-secrets → secrets)**

将 `from './ai-secrets'` 改为 `from '../secrets'`.

- [ ] **Step 5: 运行 typecheck 验证**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add -A electron/main/ai/ electron/main/secrets.ts electron/main/ipc.ts electron/main/notification.ts electron/main/ai-config.ts electron/main/ai-context.ts electron/main/ai-secrets.ts
git commit -m "refactor: consolidate AI modules into electron/main/ai/, rename ai-secrets to secrets"
```

---

### Task 6: `electron/main/` 域目录聚合——Journal

**Files:**
- Move: `electron/main/journal-document.ts` → `electron/main/journal/document.ts`
- Move: `electron/main/journal-service.ts` → `electron/main/journal/service.ts`
- Modify: `electron/main/ipc.ts`（UPDATE import paths）
- Modify: `electron/main/journal-service.ts` → `electron/main/journal/service.ts`（UPDATE 内部 import paths）
- Modify: `electron/main/workspace-libraries.ts`（UPDATE import path）
- Modify: `electron/main/report/daily-entries.ts`（UPDATE import path）
- Modify: `electron/main/ai/journal-ai-service.ts`（UPDATE import path）

- [ ] **Step 1: 移动文件**

需要先创建 `electron/main/journal/` 目录。

```bash
New-Item -ItemType Directory -Path electron\main\journal -Force
git mv electron/main/journal-document.ts electron/main/journal/document.ts
git mv electron/main/journal-service.ts electron/main/journal/service.ts
```

- [ ] **Step 2: 修改 `electron/main/journal/service.ts` 内部 import paths**

将：
```typescript
} from './journal-document'
} from './workspace-libraries'
} from './workspace-paths'
```
改为：
```typescript
} from './document'
} from '../workspace-libraries'
} from '../workspace-paths'
```

- [ ] **Step 3: 修改 `electron/main/workspace-libraries.ts` 第 9 行**

```diff
- import { normalizeStringList, readJournalDocument } from './journal-document'
+ import { normalizeStringList, readJournalDocument } from './journal/document'
```

- [ ] **Step 4: 修改 `electron/main/report/daily-entries.ts` 第 4 行**

```diff
- import { countJournalWords, readJournalDocument } from '../journal-document'
+ import { countJournalWords, readJournalDocument } from '../journal/document'
```

- [ ] **Step 5: 修改 `electron/main/ai/journal-ai-service.ts` 第 10 行**

```diff
- import { normalizeStringList } from '../journal-document'
+ import { normalizeStringList } from '../journal/document'
```

- [ ] **Step 6: 修改 `electron/main/ipc.ts` 第 62-67 行 import paths**

```diff
} from './journal-service'
```
改为：
```typescript
} from './journal/service'
```

- [ ] **Step 7: 运行 typecheck**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 8: Commit**

```bash
git add -A electron/main/journal/ electron/main/ipc.ts electron/main/workspace-libraries.ts electron/main/report/daily-entries.ts electron/main/ai/journal-ai-service.ts
git commit -m "refactor: move journal modules into electron/main/journal/"
```

---

### Task 7: `electron/main/` 域目录聚合——Workspace

**Files:**
- Move: `electron/main/workspace-libraries.ts` → `electron/main/workspace/libraries.ts`
- Move: `electron/main/workspace-paths.ts` → `electron/main/workspace/paths.ts`
- Modify: 所有引用这两个文件的上游模块

**引用方列表（需全部改 import）：**
- `electron/main/ipc.ts` 第 85-91 行
- `electron/main/journal/service.ts`（已是 `./document` 后，需改 `../workspace-libraries` → `../workspace/libraries`）
- `electron/main/report/daily-entries.ts` 第 5-6 行
- `electron/main/report/storage.ts` 第 18 行
- `electron/main/report/range.ts` 第 7 行
- `electron/main/ai/journal-ai-service.ts` 第 6 行

- [ ] **Step 1: 移动文件**

```bash
New-Item -ItemType Directory -Path electron\main\workspace -Force
git mv electron/main/workspace-libraries.ts electron/main/workspace/libraries.ts
git mv electron/main/workspace-paths.ts electron/main/workspace/paths.ts
```

- [ ] **Step 2: 修改 `electron/main/workspace/libraries.ts` 内部 import**

第 9 行 `from './journal-document'`（这是旧路径，现有代码已改）不——文件移动后 libraries.ts 内的相对 import：
- 第 8 行 `} from './constants'` → `} from '../constants'`
- 第 9 行 `import { normalizeStringList, readJournalDocument } from './journal-document'` → `import { normalizeStringList, readJournalDocument } from '../journal/document'`（注意：此 import 在 Task 6 已指向 `./journal/document`，移动到 workspace/ 后变为 `../journal/document`）
- 第 12-16 行 `} from './workspace-paths'` → `} from './paths'`

- [ ] **Step 3: 修改 `electron/main/workspace/paths.ts` 内部 import**

检查 `workspace-paths.ts` 是否有对同级文件的 import。无——它只 import `node:path`、types 和 `dayjs`。路径无需改变。

- [ ] **Step 4: 修改所有上游模块的 import paths**

`electron/main/ipc.ts` 第 85-91 行：
```diff
- } from './workspace-libraries'
+ } from './workspace/libraries'
```

`electron/main/journal/service.ts` 第 26-31 行：
```diff
- } from '../workspace-libraries'
- } from '../workspace-paths'
+ } from '../workspace/libraries'
+ } from '../workspace/paths'
```

`electron/main/report/daily-entries.ts` 第 5-6 行：
```diff
- import { getWorkspaceTags } from '../workspace-libraries'
- import { resolveJournalEntryFilePath } from '../workspace-paths'
+ import { getWorkspaceTags } from '../workspace/libraries'
+ import { resolveJournalEntryFilePath } from '../workspace/paths'
```

`electron/main/report/storage.ts` 第 18 行：
```diff
- } from '../workspace-paths'
+ } from '../workspace/paths'
```

`electron/main/report/range.ts` 第 7 行：
```diff
- import { assertValidDate, assertValidMonth, assertValidYear } from '../workspace-paths'
+ import { assertValidDate, assertValidMonth, assertValidYear } from '../workspace/paths'
```

`electron/main/ai/journal-ai-service.ts` 第 6 行：
```diff
- import { assertValidDate } from '../workspace-paths'
+ import { assertValidDate } from '../workspace/paths'
```

- [ ] **Step 5: 运行 typecheck**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add -A electron/main/workspace/ electron/main/ipc.ts electron/main/journal/service.ts electron/main/report/daily-entries.ts electron/main/report/storage.ts electron/main/report/range.ts electron/main/ai/journal-ai-service.ts
git commit -m "refactor: move workspace modules into electron/main/workspace/"
```

---

### Task 8: 删除 report-service / report-export-service 转发 shim

**Files:**
- Delete: `electron/main/report-service.ts`
- Delete: `electron/main/report-export-service.ts`
- Modify: `electron/main/ipc.ts`（import report 和 report-export 直接从目录 index）
- Modify: `electron/main/report-export/index.ts`（import 直接从 `../report` 而非 `../report-service`）

- [ ] **Step 1: 修改 `electron/main/report-export/index.ts` 第 12 行**

```diff
- import { getRangeReport } from '../report-service'
+ import { getRangeReport } from '../report'
```

- [ ] **Step 2: 修改 `electron/main/ipc.ts` 第 68-73 行**

```diff
- import { generateRangeReport, getRangeReport, listRangeReports } from './report-service'
+ import { generateRangeReport, getRangeReport, listRangeReports } from './report'
```

```diff
- import {
-   exportRangeReportPng,
-   getReportExportPayload,
-   notifyReportExportReady,
- } from './report-export-service'
+ import {
+   exportRangeReportPng,
+   getReportExportPayload,
+   notifyReportExportReady,
+ } from './report-export'
```

- [ ] **Step 3: 删除 shim 文件**

```bash
git rm electron/main/report-service.ts
git rm electron/main/report-export-service.ts
```

- [ ] **Step 4: 运行 typecheck**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove report-service shims, import directly from report/ and report-export/"
```

---

### Task 9: 消除 `src/shared/theme.ts` 与 `theme/` 目录的并存歧义

**Files:**
- Move: `src/shared/theme.ts` → `src/shared/theme/apply.ts`
- Modify: `src/app/composables/useAppShell.ts`（UPDATE import path）
- Modify: `src/components/report/export/composables/useReportExportTheme.ts`（UPDATE import path）

- [ ] **Step 1: 移动文件**

```bash
git mv src/shared/theme.ts src/shared/theme/apply.ts
```

- [ ] **Step 2: 修改 `src/app/composables/useAppShell.ts` 第 4 行**

```diff
- import { applyThemePreference, observeSystemThemeChange } from '../../shared/theme'
+ import { applyThemePreference, observeSystemThemeChange } from '../../shared/theme/apply'
```

- [ ] **Step 3: 修改 `src/components/report/export/composables/useReportExportTheme.ts` 第 2 行**

```diff
- import { applyThemePreference, observeSystemThemeChange } from '../../../../shared/theme'
+ import { applyThemePreference, observeSystemThemeChange } from '../../../../shared/theme/apply'
```

- [ ] **Step 4: 运行 typecheck**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move theme.ts into theme/apply.ts to resolve naming ambiguity"
```

---

## Batch 2：IPC 拆分（少量 import 变动）

### Task 10: 按域拆分 `electron/main/ipc.ts`

**Files:**
- Create: `electron/main/ipc/app.ts`
- Create: `electron/main/ipc/workspace.ts`
- Create: `electron/main/ipc/journal.ts`
- Create: `electron/main/ipc/report.ts`
- Create: `electron/main/ipc/index.ts`（聚合注册）
- Modify: `electron/main/ipc.ts` → 改为 `re-export { registerIpcHandlers } from './ipc/index'`
- Modify: `electron/main.ts`（import 路径：ipc.ts 现在 forward 到 ipc/index，路径不变所以 main.ts 不用改）

**说明：** 此 Task 在 Batch 1 的目录聚合之后再执行。拆分后 `electron/main/ipc/` 目录下每个文件按域组织，自己 import 需要调用的 service。

- [ ] **Step 1: 创建 `electron/main/ipc/index.ts`（聚合注册函数）**

```typescript
import { registerAppIpcHandlers } from './app'
import { registerWorkspaceIpcHandlers } from './workspace'
import { registerJournalIpcHandlers } from './journal'
import { registerReportIpcHandlers } from './report'

export function registerIpcHandlers() {
  registerAppIpcHandlers()
  registerWorkspaceIpcHandlers()
  registerJournalIpcHandlers()
  registerReportIpcHandlers()
}
```

- [ ] **Step 2: 创建 `electron/main/ipc/app.ts`**

包含以下 handler（从当前 ipc.ts 移出）：getBootstrap、getThemePreference、getAiSettingsStatus、setThemePreference、setWindowZoomFactor、saveAiSettings、saveAiApiKey、getAiContext、saveAiContext、setJournalHeatmapEnabled、setDayStartHour、setWindowCloseBehavior、setLaunchOnStartupPreference、setNotificationPreference、getEmailNotificationStatus、saveEmailNotificationAuthCode、setFrontmatterVisibility、setWindowDirtyState、openExternalLink、openDevTools。

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels'
import type {
  AppBootstrap,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  LaunchOnStartupPreferenceInput,
  NotificationPreferenceInput,
  OpenExternalLinkInput,
  SaveEmailNotificationAuthCodeInput,
  ThemePreferenceInput,
  WindowCloseBehaviorPreferenceInput,
  WindowDirtyStateInput,
  WindowZoomPreferenceInput,
} from '../../../src/types/app'
import type { SaveAiApiKeyInput, SaveAiContextInput, SaveAiSettingsInput } from '../../../src/types/ai'
import { readAppConfig, setDayStartHour, setFrontmatterVisibility, setJournalHeatmapEnabled, setLaunchOnStartupPreference, setNotificationPreference, setThemePreference, setWindowCloseBehavior } from '../app-config'
import { getAiSettingsStatus, saveAiSettings } from '../ai/config'
import { getAiContextDocument, saveAiContext } from '../ai/context'
import { getEmailNotificationStatus, saveAiApiKey, saveEmailNotificationAuthCode } from '../secrets'
import { applyLaunchOnStartup } from '../launch-on-startup'
import { configureDiaryReminder } from '../notification'
import { openMainWindowDevTools, applyNativeThemeSource, applyWindowCloseBehavior, setWindowDirtyState, updateWindowZoomFactor } from '../window'

export function registerAppIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async (): Promise<AppBootstrap> => {
    const config = await readAppConfig()
    const emailNotificationStatus = await getEmailNotificationStatus()
    return { config, emailNotificationStatus }
  })

  ipcMain.handle(IPC_CHANNELS.getThemePreference, async () => {
    const config = await readAppConfig()
    return config.ui.theme
  })

  ipcMain.handle(IPC_CHANNELS.getAiSettingsStatus, () => {
    return getAiSettingsStatus()
  })

  ipcMain.handle(IPC_CHANNELS.setThemePreference, async (_event, input: ThemePreferenceInput) => {
    const nextConfig = await setThemePreference(input)
    applyNativeThemeSource(nextConfig.ui.theme)
    return nextConfig
  })

  ipcMain.handle(IPC_CHANNELS.setWindowZoomFactor, (_event, input: WindowZoomPreferenceInput) => {
    return updateWindowZoomFactor(input.zoomFactor)
  })

  ipcMain.handle(IPC_CHANNELS.saveAiSettings, (_event, input: SaveAiSettingsInput) => {
    return saveAiSettings(input)
  })

  ipcMain.handle(IPC_CHANNELS.saveAiApiKey, (_event, input: SaveAiApiKeyInput) => {
    return saveAiApiKey(input)
  })

  ipcMain.handle(IPC_CHANNELS.getAiContext, () => {
    return getAiContextDocument()
  })

  ipcMain.handle(IPC_CHANNELS.saveAiContext, (_event, input: SaveAiContextInput) => {
    return saveAiContext(input)
  })

  ipcMain.handle(IPC_CHANNELS.setJournalHeatmapEnabled, (_event, input: JournalHeatmapPreferenceInput) => {
    return setJournalHeatmapEnabled(input)
  })

  ipcMain.handle(IPC_CHANNELS.setDayStartHour, (_event, input: DayStartHourPreferenceInput) => {
    return setDayStartHour(input)
  })

  ipcMain.handle(IPC_CHANNELS.setWindowCloseBehavior, async (_event, input: WindowCloseBehaviorPreferenceInput) => {
    const nextConfig = await setWindowCloseBehavior(input)
    applyWindowCloseBehavior(nextConfig.ui.closeBehavior)
    return nextConfig
  })

  ipcMain.handle(IPC_CHANNELS.setLaunchOnStartupPreference, async (_event, input: LaunchOnStartupPreferenceInput) => {
    applyLaunchOnStartup(input.enabled)
    return setLaunchOnStartupPreference(input)
  })

  ipcMain.handle(IPC_CHANNELS.setNotificationPreference, async (_event, input: NotificationPreferenceInput) => {
    const nextConfig = await setNotificationPreference(input)
    configureDiaryReminder(nextConfig.ui.notification)
    return nextConfig
  })

  ipcMain.handle(IPC_CHANNELS.getEmailNotificationStatus, () => {
    return getEmailNotificationStatus()
  })

  ipcMain.handle(IPC_CHANNELS.saveEmailNotificationAuthCode, (_event, input: SaveEmailNotificationAuthCodeInput) => {
    return saveEmailNotificationAuthCode(input)
  })

  ipcMain.handle(IPC_CHANNELS.setFrontmatterVisibility, (_event, input: FrontmatterVisibilityInput) => {
    return setFrontmatterVisibility(input)
  })

  ipcMain.handle(IPC_CHANNELS.setWindowDirtyState, (_event, input: WindowDirtyStateInput) => {
    setWindowDirtyState(input.isDirty)
  })

  ipcMain.handle(IPC_CHANNELS.openExternalLink, async (_event, input: OpenExternalLinkInput) => {
    const { shell } = await import('electron')
    const url = input.url.trim()
    if (!/^https:\/\/.+/i.test(url) && !/^mailto:.+/i.test(url)) {
      throw new Error('暂不支持打开这个地址。')
    }
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC_CHANNELS.openDevTools, () => {
    openMainWindowDevTools()
  })
}
```

- [ ] **Step 3: 创建 `electron/main/ipc/workspace.ts`**

```typescript
import { dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels'
import type { OpenWorkspaceFolderInput, WorkspaceSelectionResult, WorkspaceStringListInput } from '../../../src/types/workspace'
import { buildWorkspaceConfig, readAppConfig, writeAppConfig } from '../app-config'
import { getMainWindow } from '../window'
import { getWorkspaceLocationOptions, getWorkspaceTags, getWorkspaceWeatherOptions, setWorkspaceLocationOptions, setWorkspaceTags, setWorkspaceWeatherOptions } from '../workspace/libraries'

export function registerWorkspaceIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async (): Promise<WorkspaceSelectionResult> => {
    const currentConfig = await readAppConfig()
    const win = getMainWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '选择日记目录',
          buttonLabel: '选择这个目录',
          properties: ['openDirectory'],
          defaultPath: currentConfig.lastOpenedWorkspace ?? undefined,
        })
      : await dialog.showOpenDialog({
          title: '选择日记目录',
          buttonLabel: '选择这个目录',
          properties: ['openDirectory'],
          defaultPath: currentConfig.lastOpenedWorkspace ?? undefined,
        })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, workspacePath: null, config: currentConfig }
    }
    const workspacePath = result.filePaths[0]
    const nextConfig = buildWorkspaceConfig(workspacePath, currentConfig)
    await writeAppConfig(nextConfig)
    return { canceled: false, workspacePath, config: nextConfig }
  })

  ipcMain.handle(IPC_CHANNELS.openWorkspaceFolder, async (_event, input: OpenWorkspaceFolderInput) => {
    const { shell } = await import('electron')
    const workspacePath = input.workspacePath.trim()
    if (!workspacePath) {
      throw new Error('当前还没有可打开的工作区目录。')
    }
    const errorMessage = await shell.openPath(workspacePath)
    if (errorMessage) {
      throw new Error(`打开目录失败：${errorMessage}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.getWorkspaceTags, (_event, workspacePath: string) => getWorkspaceTags(workspacePath))
  ipcMain.handle(IPC_CHANNELS.setWorkspaceTags, (_event, input: WorkspaceStringListInput) => setWorkspaceTags(input))
  ipcMain.handle(IPC_CHANNELS.getWorkspaceWeatherOptions, (_event, workspacePath: string) => getWorkspaceWeatherOptions(workspacePath))
  ipcMain.handle(IPC_CHANNELS.setWorkspaceWeatherOptions, (_event, input: WorkspaceStringListInput) => setWorkspaceWeatherOptions(input))
  ipcMain.handle(IPC_CHANNELS.getWorkspaceLocationOptions, (_event, workspacePath: string) => getWorkspaceLocationOptions(workspacePath))
  ipcMain.handle(IPC_CHANNELS.setWorkspaceLocationOptions, (_event, input: WorkspaceStringListInput) => setWorkspaceLocationOptions(input))
}
```

- [ ] **Step 4: 创建 `electron/main/ipc/journal.ts`**

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels'
import type { GenerateDailyInsightsInput } from '../../../src/types/ai'
import type { JournalEntryBodySaveInput, JournalEntryMetadataSaveInput, JournalEntryQuery, JournalMonthActivityQuery } from '../../../src/types/journal'
import { generateDailyInsights } from '../ai'
import { createJournalEntry, getJournalMonthActivity, readJournalEntry, saveJournalEntryBody, saveJournalEntryMetadata } from '../journal/service'

export function registerJournalIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.readJournalEntry, (_event, input: JournalEntryQuery) => readJournalEntry(input))
  ipcMain.handle(IPC_CHANNELS.createJournalEntry, (_event, input: JournalEntryQuery) => createJournalEntry(input))
  ipcMain.handle(IPC_CHANNELS.saveJournalEntryBody, (_event, input: JournalEntryBodySaveInput) => saveJournalEntryBody(input))
  ipcMain.handle(IPC_CHANNELS.saveJournalEntryMetadata, (_event, input: JournalEntryMetadataSaveInput) => saveJournalEntryMetadata(input))
  ipcMain.handle(IPC_CHANNELS.getJournalMonthActivity, (_event, input: JournalMonthActivityQuery) => getJournalMonthActivity(input))
  ipcMain.handle(IPC_CHANNELS.generateDailyInsights, (_event, input: GenerateDailyInsightsInput) => generateDailyInsights(input))
}
```

- [ ] **Step 5: 创建 `electron/main/ipc/report.ts`**

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels'
import type { ExportRangeReportInput, GenerateRangeReportInput, ReportExportPayloadQuery, ReportExportReadyInput, ReportQuery } from '../../../src/types/report'
import { generateRangeReport, getRangeReport, listRangeReports } from '../report'
import { exportRangeReportPng, getReportExportPayload, notifyReportExportReady } from '../report-export'

export function registerReportIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.generateRangeReport, (_event, input: GenerateRangeReportInput) => generateRangeReport(input))
  ipcMain.handle(IPC_CHANNELS.getRangeReport, (_event, input: ReportQuery) => getRangeReport(input))
  ipcMain.handle(IPC_CHANNELS.listRangeReports, (_event, workspacePath: string) => listRangeReports(workspacePath))
  ipcMain.handle(IPC_CHANNELS.exportRangeReportPng, (_event, input: ExportRangeReportInput) => exportRangeReportPng(input))
  ipcMain.handle(IPC_CHANNELS.getReportExportPayload, (_event, input: ReportExportPayloadQuery) => getReportExportPayload(input))
  ipcMain.handle(IPC_CHANNELS.notifyReportExportReady, (_event, input: ReportExportReadyInput) => notifyReportExportReady(input))
}
```

- [ ] **Step 6: 修改 `electron/main/ipc.ts`——改为转发文件**

将整个 ipc.ts 内容替换为：

```typescript
export { registerIpcHandlers } from './ipc/index'
```

- [ ] **Step 7: 确认 `electron/main.ts` 无需改动**

`electron/main.ts` 第 3 行 `import { registerIpcHandlers } from './main/ipc'`，ipc.ts 现在 re-export `registerIpcHandlers` from `./ipc/index`，导入路径 `./main/ipc` 无需变。

但需确认 `electron/main.ts` 不再需要 `import './main/constants'`（第 7 行）。它 import constants 是因为 constants 定义被执行时需要设置 `process.env.APP_ROOT` 等副作用。`ipc/index.ts` 的 import 链里没有 constants（各 ipc domain 文件 import 的都是具体的服务模块），所以 `main.ts` 仍然需要 `import './main/constants'` 以保证副作用执行。不动。

- [ ] **Step 8: 运行 typecheck**

```bash
cmd /c npm run typecheck
```

Expected: 通过。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: split ipc.ts into domain-specific modules under electron/main/ipc/"
```

---

## Batch 3：渲染进程 settings 状态下沉（行为等价重构）

> **注意：** Batch 3 只涉及渲染进程内部重构，主进程不受影响。它独立于 Batch 1、2，有足够的复杂度需要单独计划和验证。此 plan 仅描述 Batch 3 的目标和边界，具体步骤留待 follow-up plan 详细展开。

**目标：**

1. **抽取 `useSaveOperation()`** —— 消除 `state.ts` 中 20+ 个模式的 `isSavingXxx` + `xxxSaveMessage` ref 对
2. **下沉 settings 状态到 `src/components/settings/composables/useSettings.ts`** —— `SettingsPanel` 自行消费，不再从 `AppShellPage.vue` 逐条传递 props/events
3. **减少 `AppShellPage.vue` 的解构项** —— 目标从 ~90 项降为 ~40 项

**影响范围：**
- `src/shared/`（新建 `useSaveOperation.ts`）
- `src/app/composables/app-shell/state.ts`（大量删除 ref）
- `src/app/composables/app-shell/preferences.ts`（handler 迁移）
- `src/app/composables/useAppShell.ts`（不再混收 preferences）
- `src/app/pages/AppShellPage.vue`（大段模板简化为 `<SettingsPanel />` 内部自治）
- `src/components/settings/panel/SettingsPanel.vue`（改为消费自身的 `useSettings` composable）
- `src/components/settings/sections/*.vue`（emits 接口不变，只调整调用者）

**不涉及：**
- 日记主流程（journal）、报告（report）、导出（report-export）
- 主进程任何文件
- types 或 IPC 契约
