# Memory + MCP Toggle Implementation Plan

> **For agentic workers:** 按 Task 顺序执行，每个 Task 完成后运行 `npm run typecheck` 并提交。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主进程内构建统一的 memory 能力模块（检索/批读/grep/画像/摘要/元索引），为 MCP 奠定基础；并新增 MCP 服务（官方 SDK + Streamable HTTP）与设置页手动开关。

**Architecture:** 新增 `electron/main/memory` 作为记忆域能力层，复用现有日记/画像/AI 模块；新增 `electron/main/mcp` 托管 MCP 服务，绑定 `127.0.0.1` 并由设置页开关控制启停。memory 能力**不经过 IPC 暴露给渲染层**——MCP server 在主进程内直接调用；渲染层仅有 MCP 偏好设置（开关/端口/运行状态）。

**Tech Stack:** Electron, Vue 3, TypeScript, `@modelcontextprotocol/sdk`（Streamable HTTP, stateless）, existing dAiry AI provider stack

---

## 关键决策（已与设计文档对齐）

1. MCP 协议层使用官方 `@modelcontextprotocol/sdk`，Streamable HTTP transport（stateless），端点 `http://127.0.0.1:{port}/mcp`；
2. MCP 工具接受可选 `workspacePath`，缺省回退 `config.lastOpenedWorkspace`，均无则返回中文错误；
3. memory 能力不新增 `memory:*` IPC 通道与 preload API；preload 仅新增 `setMcpPreference` / `getMcpRuntimeStatus`；
4. MCP 工具名用下划线风格（`memory_search` 等），符合 MCP 命名规范；
5. 画像读取按年版本（`user-profile/user-profile-YYYY.md`），取最新年份，只读回退兼容 legacy `user-profile.md`。

---

## File Structure (Planned)

- Create: `src/types/mcp.ts`
- Modify: `src/types/api.ts`
- Modify: `src/types/app.ts`
- Modify: `src/shared/defaults.ts`
- Modify: `src/shared/ipc-channels.ts`
- Create: `electron/main/memory/types.ts`
- Create: `electron/main/memory/retrieval.ts`
- Create: `electron/main/memory/search.ts`
- Create: `electron/main/memory/index.ts`
- Create: `electron/main/ai/prompts/memory-search-filter.system.md`
- Create: `electron/main/ai/prompts/memory-search-rerank.system.md`
- Create: `electron/main/ai/prompts/memory-search-summarize.system.md`
- Modify: `electron/main/ai/prompt-loader.ts`
- Modify: `electron/main/ai/journal-ai-service.ts`（导出 `ensureAiSettingsReady`）
- Modify: `electron/main/ai/index.ts`
- Modify: `electron/main/app-config.ts`
- Create: `electron/main/mcp/server.ts`
- Create: `electron/main/mcp/tools.ts`
- Create: `electron/main/mcp/index.ts`
- Create: `electron/main/ipc/mcp.ts`
- Modify: `electron/main/ipc/index.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `src/components/settings/config/config.ts`
- Create: `src/components/settings/sections/SettingsMcpSection.vue`
- Create: `src/components/settings/sections/SettingsMcpSection.css`
- Modify: `src/components/settings/panel/SettingsPanel.vue`
- Modify: `src/app/composables/app-shell/state.ts`
- Modify: `src/app/composables/app-shell/preferences.ts`
- Modify: `src/app/composables/app-shell/journal.ts`（`syncConfigState`）
- Modify: `src/app/composables/useAppShell.ts`
- Modify: `src/app/pages/AppShellPage.vue`
- Modify: `package.json`（新增 `@modelcontextprotocol/sdk` 依赖）

---

## Plan Guardrails

- 本仓库当前仅有 `npm run typecheck`（`vue-tsc --noEmit`），未引入独立单测框架；
- 为避免污染生产源码目录，本计划不再新增 `*.typecheck.ts` 临时文件；
- 验证步骤统一通过 `npm run typecheck` 与关键链路手工联调完成；
- 每个 Task 的提交都在 `feat/memory-mcp` 分支上进行。

---

### Task 1: 建立共享类型、IPC 通道与 preload 骨架

**Files:**
- Create: `src/types/mcp.ts`
- Create: `electron/main/memory/types.ts`
- Modify: `src/types/api.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 建立 `src/types/mcp.ts`**

```ts
export interface McpConfig {
  enabled: boolean
  port: number
}

export interface McpPreferenceInput {
  enabled: boolean
  port: number
}

export interface McpRuntimeStatus {
  status: 'stopped' | 'running' | 'error'
  port: number | null
  errorMessage: string | null
}
```

- [ ] **Step 2: 建立 `electron/main/memory/types.ts` 最小类型集**

```ts
export interface MemorySearchInput {
  workspacePath: string
  query: string
  years?: string[]
  limit?: number
}

export interface MemorySearchResult {
  query: string
  answer: string
  relatedDates: string[]
  displayedCount: number
  totalCount: number
  confidence: 'high' | 'medium' | 'low'
}

export interface MemoryEntryDocument {
  date: string
  summary: string
  body: string
  mood: number
  tags: string[]
}

export interface MemoryGrepMatch {
  date: string
  snippet: string
}

export interface MemoryMetaCandidate {
  date: string
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
  wordCount: number
}

export interface MemoryUserProfile {
  year: string | null
  content: string
}
```

- [ ] **Step 3: 扩展 `src/types/api.ts` 与 `src/shared/ipc-channels.ts`**

`DairyApi` 增加：

```ts
setMcpPreference: (input: McpPreferenceInput) => Promise<AppConfig>
getMcpRuntimeStatus: () => Promise<McpRuntimeStatus>
```

`IPC_CHANNELS` 增加：

```ts
setMcpPreference: 'app:set-mcp-preference',
getMcpRuntimeStatus: 'app:get-mcp-runtime-status',
```

- [ ] **Step 4: 在 `electron/preload.ts` 补齐两个方法实现**

注意：本步必须与 Step 3 同 Task 完成，否则 `dairyApi: DairyApi` 缺成员导致 typecheck 失败。

- [ ] **Step 5: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过。

- [ ] **Step 6: Commit**

```bash
git add src/types/mcp.ts electron/main/memory/types.ts src/types/api.ts src/shared/ipc-channels.ts electron/preload.ts
git commit -m "feat(memory): add memory domain types and mcp preference protocol"
```

---

### Task 2: 构建 memory retrieval 基础能力

**Files:**
- Create: `electron/main/memory/retrieval.ts`
- Create: `electron/main/memory/index.ts`

- [ ] **Step 1: 实现 retrieval 模块**

至少实现：

```ts
export function uniqDates(dates: string[]): string[]
export async function readMetaCandidates(workspacePath: string, years: string[]): Promise<MemoryMetaCandidate[]>
export async function listJournalYears(workspacePath: string): Promise<string[]>
export async function batchReadEntries(workspacePath: string, dates: string[]): Promise<MemoryEntryDocument[]>
export async function grepDiaryText(workspacePath: string, keyword: string): Promise<MemoryGrepMatch[]>
export async function getMetaIndex(workspacePath: string, year: string): Promise<JournalMetaIndex | null>
export async function getUserProfile(workspacePath: string): Promise<MemoryUserProfile>
export async function getRecentSummaries(workspacePath: string, date: string, days: number): Promise<RecentDaySummary[]>
```

要求：

- 复用 `readJournalMetaIndex`、`readJournalDocument`、`resolveJournalEntryFilePath`、`getWorkspaceJournalDir`；
- `getRecentSummaries` 直接复用 `journal-ai-service` 的 `getRecentDailySummaries`；
- `getUserProfile` 列出 `.dairy/user-profile/user-profile-*.md` 取最新年份读取（只读），无则回退 legacy `user-profile.md`，都没有返回 `{ year: null, content: '' }`；
- `batchReadEntries` 遇缺失文件跳过，不抛 ENOENT；
- `grepDiaryText` 遍历 `journal/YYYY/MM/*.md`，大小写不敏感子串匹配，返回前后文 snippet，结果按日期升序，设上限（如 50 条）；
- `readMetaCandidates` 将年度 meta 索引的 `MM-DD` 键展开为 `YYYY-MM-DD` 候选，meta 缺失的年份跳过。

- [ ] **Step 2: `index.ts` 统一导出**

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过。

- [ ] **Step 4: Commit**

```bash
git add electron/main/memory/retrieval.ts electron/main/memory/index.ts
git commit -m "feat(memory): add retrieval primitives"
```

---

### Task 3: 实现语义检索编排（search pipeline）

**Files:**
- Create: `electron/main/memory/search.ts`
- Create: `electron/main/ai/prompts/memory-search-filter.system.md`
- Create: `electron/main/ai/prompts/memory-search-rerank.system.md`
- Create: `electron/main/ai/prompts/memory-search-summarize.system.md`
- Modify: `electron/main/ai/prompt-loader.ts`
- Modify: `electron/main/ai/journal-ai-service.ts`（导出 `ensureAiSettingsReady`）
- Modify: `electron/main/ai/index.ts`

- [ ] **Step 1: 导出 AI 就绪检查**

`journal-ai-service.ts` 的 `ensureAiSettingsReady` 加 `export`，并在 `ai/index.ts` re-export，供 search 复用。

- [ ] **Step 2: 注册 3 个新 prompt 到 `prompt-loader.ts` 的 `PROMPT_FILE_MAP`**

- [ ] **Step 3: 实现 search 编排**

关键函数：

```ts
export function splitIntoChunks<T>(items: T[], size: number): T[][]
export async function searchMemory(input: MemorySearchInput): Promise<MemorySearchResult>
```

执行流程：

1. 校验 `workspacePath` / `query` 非空（中文错误）；`years` 缺省时用 `listJournalYears` 全量；
2. `readMetaCandidates` 读取候选；无候选时返回空结果与友好提示，不抛异常；
3. 候选分片调用 `memory-search-filter` 得到 `journalListA`（去重、校验日期格式）；
4. `batchReadEntries` + 分片并行调用 `memory-search-rerank` 得到带分数结果，过滤低分、按分数排序得到 `journalListB`；
5. 按 `limit`（默认 10）截断展示集，调用 `memory-search-summarize` 生成 `answer`；
6. 返回结构化结果。

错误策略：

- AI 配置不完整时抛中文错误（复用 `ensureAiSettingsReady`）；
- 无命中时返回空结果与友好提示，不抛异常；
- `settings.timeoutMs = Math.max(settings.timeoutMs, 60_000)`，与现有链路一致。

- [ ] **Step 4: 补充 prompt 文件内容**

每个 prompt 明确约束：

- 必须只依据输入文本，不允许捏造；
- 输出 JSON，字段严格；
- 日期格式固定 `YYYY-MM-DD`。

- [ ] **Step 5: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过。

- [ ] **Step 6: Commit**

```bash
git add electron/main/memory/search.ts electron/main/ai/prompts/memory-search-filter.system.md electron/main/ai/prompts/memory-search-rerank.system.md electron/main/ai/prompts/memory-search-summarize.system.md electron/main/ai/prompt-loader.ts electron/main/ai/journal-ai-service.ts electron/main/ai/index.ts
git commit -m "feat(memory): implement multi-stage semantic search pipeline"
```

---

### Task 4: 增加 MCP 配置模型与持久化

**Files:**
- Modify: `src/types/app.ts`
- Modify: `src/shared/defaults.ts`
- Modify: `electron/main/app-config.ts`

- [ ] **Step 1: 扩展 `AppConfig` 与默认值**

`src/types/app.ts`：`AppConfig` 新增 `mcp: McpConfig`（从 `./mcp` import）。

`src/shared/defaults.ts` 的 `createDefaultAppConfig()` 增加：

```ts
mcp: {
  enabled: false,
  port: 9123,
},
```

- [ ] **Step 2: 在 `app-config.ts` 实现归一化 + setter**

新增：

```ts
export function normalizeMcpConfig(raw: Partial<McpConfig> | null | undefined): McpConfig
export async function setMcpPreference(input: McpPreferenceInput): Promise<AppConfig>
```

归一化规则：

- `enabled` 仅接受布尔，默认 false；
- `port` 必须整数且 1024-65535，否则回退 9123。

并在 `normalizeAppConfig` 中接入 `mcp: normalizeMcpConfig(config.mcp)`。

注意：setter 只负责持久化；服务启停在 IPC 层串行执行（先写配置，再按最新配置启停）。

- [ ] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/types/app.ts src/shared/defaults.ts electron/main/app-config.ts
git commit -m "feat(app-config): add mcp preference config and normalization"
```

---

### Task 5: MCP 服务生命周期、工具映射与主进程接入

**Files:**
- Modify: `package.json`（`npm install @modelcontextprotocol/sdk`）
- Create: `electron/main/mcp/server.ts`
- Create: `electron/main/mcp/tools.ts`
- Create: `electron/main/mcp/index.ts`
- Create: `electron/main/ipc/mcp.ts`
- Modify: `electron/main/ipc/index.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: 安装依赖**

Run: `npm install @modelcontextprotocol/sdk`

安装后先浏览 SDK 的 `dist/esm/server/mcp.d.ts` 与 `streamableHttp.d.ts` 类型定义，确认 `McpServer.registerTool` 与 `StreamableHTTPServerTransport` 的实际签名再写代码。

- [ ] **Step 2: 实现工具映射 `tools.ts`**

```ts
export function createMemoryMcpServer(): McpServer
```

注册 6 个只读工具（下划线命名）：`memory_search`、`memory_batch_read_entries`、`memory_grep_diary`、`memory_get_user_profile`、`memory_get_recent_summaries`、`memory_get_meta_index`。

工作区解析：

```ts
async function resolveWorkspacePath(raw?: string): Promise<string>
```

优先显式入参，缺省回退 `readAppConfig().lastOpenedWorkspace`，均无抛中文错误。

工具返回 `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`；工具内异常捕获后返回中文错误文本，不让单工具异常击穿服务。

- [ ] **Step 3: 实现生命周期 `server.ts`**

```ts
export async function startMcpServer(port: number): Promise<McpRuntimeStatus>
export async function stopMcpServer(): Promise<McpRuntimeStatus>
export function getMcpRuntimeStatus(): McpRuntimeStatus
```

约束：

- 仅监听 `127.0.0.1`，端点路径 `/mcp`；
- stateless：`new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`；
- 启动失败（端口占用等）返回 `error` 状态 + 中文 `errorMessage`，不抛致命异常；
- 幂等：重复 start（同端口）直接返回当前状态，重复 stop 不崩溃；不同端口 start 先 stop 再启动；
- start/stop 串行化（内部 promise 链），避免快速切换产生竞态。

- [ ] **Step 4: 主进程启动时接入 `electron/main.ts`**

- app ready 后读取 `config.mcp.enabled`，为 true 则按 `config.mcp.port` 启动（失败只记状态，不阻塞窗口创建）；
- `before-quit` 时 `void stopMcpServer()`。

- [ ] **Step 5: IPC 注册 `ipc/mcp.ts` 并接入 `ipc/index.ts`**

```ts
ipcMain.handle(IPC_CHANNELS.setMcpPreference, async (_e, input: McpPreferenceInput) => {
  const nextConfig = await setMcpPreference(input)   // 先持久化
  if (nextConfig.mcp.enabled) {
    await startMcpServer(nextConfig.mcp.port)        // 再按最新配置启停
  } else {
    await stopMcpServer()
  }
  return nextConfig
})
ipcMain.handle(IPC_CHANNELS.getMcpRuntimeStatus, () => getMcpRuntimeStatus())
```

- [ ] **Step 6: 运行类型检查**

Run: `npm run typecheck`

Expected: 通过。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json electron/main/mcp electron/main/ipc/mcp.ts electron/main/ipc/index.ts electron/main.ts
git commit -m "feat(mcp): add local mcp service lifecycle and memory tools"
```

---

### Task 6: 设置页新增 MCP 区块与交互

**Files:**
- Create: `src/components/settings/sections/SettingsMcpSection.vue`
- Create: `src/components/settings/sections/SettingsMcpSection.css`
- Modify: `src/components/settings/config/config.ts`
- Modify: `src/components/settings/panel/SettingsPanel.vue`
- Modify: `src/app/composables/app-shell/state.ts`
- Modify: `src/app/composables/app-shell/preferences.ts`
- Modify: `src/app/composables/app-shell/journal.ts`
- Modify: `src/app/composables/useAppShell.ts`
- Modify: `src/app/pages/AppShellPage.vue`

- [ ] **Step 1: 新增 settings 分区**

`config.ts`：`SettingsSectionId` 增加 `'mcp'`，`SETTINGS_SECTIONS` 增加「MCP 服务」项（描述：手动启停本地 MCP 服务，供外部 AI 工具检索你的日记记忆）。

- [ ] **Step 2: state 与同步**

`state.ts` 新增：`mcpEnabled`、`mcpPort`、`mcpRuntimeStatus`、`mcpSaveMessage`、`isSavingMcp`。

`journal.ts` 的 `syncConfigState`：同步 `config.mcp.enabled` / `config.mcp.port`。

- [ ] **Step 3: preferences 读写流程**

`preferences.ts` 新增 `handleSaveMcpPreference({ enabled, port })`：

1. `window.dairy.setMcpPreference` 保存；
2. `syncConfigState(nextConfig)`；
3. `window.dairy.getMcpRuntimeStatus()` 刷新运行态；
4. 按结果给出中文提示（运行中/已停止/错误信息）。

bootstrap 完成后也查询一次运行态（`useAppShell.ts` onMounted 内）。

- [ ] **Step 4: `SettingsMcpSection.vue` + Panel/Page 接线**

最小交互：

- 开关（复用 `SettingsToggleRow`）；
- 端口输入（失焦或回车保存，1024-65535）；
- 运行状态展示（运行中/已停止/启动失败 + 错误信息）；
- 连接地址展示：`http://127.0.0.1:{port}/mcp`。

`SettingsPanel.vue` 新增分支与 props/emit；`AppShellPage.vue` 完成接线；`useAppShell.ts` 导出 handler。

- [ ] **Step 5: 运行类型检查、构建检查**

Run: `npm run typecheck && npm run build`

Expected: 全通过。

- [ ] **Step 6: Commit**

```bash
git add src/components/settings src/app/composables src/app/pages/AppShellPage.vue
git commit -m "feat(settings): add manual mcp toggle section"
```

---

### Task 7: 联调与回归验证

**Files:**
- Modify: `AGENTS.md`、`docs/system/*`（新增稳定约定）

- [ ] **Step 1: MCP 开关联调**

Run: `npm run dev`

操作：

1. 设置页开启 MCP，端口 9123；
2. 检查状态为「运行中」；
3. 用外部 MCP 客户端（如 OpenCode）连接 `http://127.0.0.1:9123/mcp`，调用 `memory_grep_diary` / `memory_search` 验证返回；
4. 修改端口为 9222，确认状态切换并恢复运行中；
5. 关闭开关，状态变为已停止，端口释放。

- [ ] **Step 2: 回归主流程**

Run: `npm run typecheck && npm run build`

Expected: 通过；日记保存、自动整理、报告页可正常打开。

- [ ] **Step 3: 文档同步**

补充稳定约定到：

- `AGENTS.md`（目录结构新增 `electron/main/memory/`、`electron/main/mcp/`，配置新增 `config.mcp`，MCP 约束小节）
- `docs/system/memory-mcp.md`（memory 能力清单、检索流程、MCP 生命周期与工具语义）

- [ ] **Step 4: Commit**

```bash
git add docs/system AGENTS.md
git commit -m "docs: update system docs for memory and mcp lifecycle"
```

---

## Self-Review

- Spec coverage: 记忆模块（retrieval + 语义检索）、MCP 服务生命周期、设置页开关均有对应任务；渲染层不暴露 memory 能力已与设计文档 §5.2 对齐；
- Placeholder scan: 未使用 TBD/TODO/"自行处理"等占位语句；
- Type consistency: `MemorySearchInput/Result`、`McpPreferenceInput`、`McpRuntimeStatus` 在任务中命名一致；
- Ordering fix: preload 方法与 `DairyApi` 类型同在 Task 1 完成，避免中间态 typecheck 失败；`prompt-loader.ts` 注册列入 Task 3。
