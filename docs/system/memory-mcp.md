# dAiry 记忆系统与 MCP 服务文档

## 概览

dAiry 的记忆系统是主进程内的统一能力层，负责把本地日记资产（正文、元索引、画像、摘要）组织成可检索、可总结的记忆能力。MCP 服务把记忆检索能力以只读工具形式暴露给外部 AI 工具（OpenCode、Claude Code 等），并额外提供写工具（`journal_write_entry` / `report_generate` / `report_get`），供外部 AI 在应用外撰写日记与生成报告。

```
外部 AI 工具 ──MCP(Streamable HTTP)──> electron/main/mcp ──直接调用──> electron/main/memory ──读取──> 工作区本地文件
```

写工具（`journal_write_entry` / `report_generate` / `report_get`）不经 `electron/main/memory`：由 `electron/main/mcp/write-tools.ts` 直接调用 `journal/write-flow` 与报告模块写入/读取工作区。

核心原则：

- 本地 Markdown 仍是唯一事实源，记忆能力全部是只读派生；
- memory 模块不经 IPC 暴露给渲染层，仅供主进程内部与 MCP 层直接调用；
- MCP 服务默认关闭，用户在设置页手动开启，关闭开关或退出应用即停止。

---

## 一、memory 模块（`electron/main/memory/`）

| 文件 | 职责 |
|------|------|
| [`types.ts`](../../electron/main/memory/types.ts) | 记忆域输入输出类型（不进 `src/types/`） |
| [`retrieval.ts`](../../electron/main/memory/retrieval.ts) | 数据访问与基础查询 |
| [`search.ts`](../../electron/main/memory/search.ts) | 语义检索编排（多步 LLM 流程） |
| `index.ts` | 统一导出 |

辅助函数（不直接对应工具）：

- `listJournalYears(workspacePath)`：扫描 `journal/` 下的 `YYYY` 目录名，升序返回；目录不存在返回 `[]`；
- `readMetaCandidates(workspacePath, years)`：聚合多个年度的元索引条目为候选列表（含 `date/weather/location/mood/summary/tags/wordCount`），按日期升序；
- `uniqDates(dates)`：日期去重。

---

## 二、写工具详解

| 工具 | 说明 | 关键入参 |
|------|------|----------|
| `journal_write_entry` | 完整写入日记：正文落盘 → 主进程 AI 自动整理回填 summary/tags/mood → 异步触发画像日更与时间轴日更 | `date`、`body`、`weather`、`location`、`mode?`、`organize?` |
| `report_generate` | 异步触发区间报告生成，立即返回 reportId；生成需几分钟，完成后落盘 `reports/` | `preset`、`startDate`、`endDate`、`requestedSections?` |
| `report_get` | 按 reportId 读取已落盘的报告 JSON；尚未生成/仍在生成中返回中文提示 | `reportId` |

### 2.1 `journal_write_entry`

实现：[`journal/write-flow.ts`](../../electron/main/journal/write-flow.ts) 的 `writeJournalEntryFull()`，注册在 [`mcp/write-tools.ts`](../../electron/main/mcp/write-tools.ts)。

- `weather` / `location` 必填（由用户在对话中给出）；`mode` 为 `create`（默认）/ `append` / `overwrite`，`create` 遇到已存在日记抛中文错误；`organize` 默认 `true`
- 工作区固定取 `config.lastOpenedWorkspace`，不接收 `workspacePath` 参数
- 正文先落盘（更新 `updatedAt` 与元索引），再调用 `generateDailyInsights` 自动整理；整理成功则回填 summary/tags/mood 并合并候选库，随后**异步**触发 `runProfileMaintenance` 与 `updateTimelineForDay`（不阻塞返回，失败只记日志）
- 整理失败不抛错：正文已保存，返回 `organize.status = 'failed'` 与 `warning`
- 候选库新增项（`addedWeather` / `addedLocations` / `addedTags`）通过合并前后差值计算，由 `libraries.ts` 的 merge 函数返回

### 2.2 `report_generate`（异步）

- 提交时仅做参数校验（`validateReportRange`：日期格式、月报/年报完整自然月年、自定义跨度 ≤ 1 年），生成报告 ID（`resolveTargetReportId`：月报 `month_YYYY-MM`、年报 `year_YYYY`、自定义 `custom_<start>_<end>_<ts>`）
- 后台执行 `generateRangeReport`（复用应用内实现，含缺失日级 insight 补做，不回写原始 .md），并通过 `overwriteReportId` 保证落盘 ID 与返回的 reportId 一致；失败信息记录在进程内 Map（`reportTaskErrors`），由 `report_get` 反馈
- 立即返回 `{ reportId, preset, status: 'submitted', notice }`；同一 preset 同区间的月报/年报会覆盖旧文件；允许失败后重新提交

### 2.3 `report_get`

- 复用 `getRangeReport`（`resolveReportPathCandidates` + `readReportWithFallback`），reportId 前缀自带类型定位
- `reportTaskErrors` 有记录 → 返回"报告生成失败：<原因>"；文件不存在（ENOENT）→ 返回"报告尚未生成或仍在生成中"

---

## 三、工具详解

| 工具 | 说明 | 关键入参 |
|------|------|----------|
| `memory_search` | 语义检索日记，返回详尽回答 + 发现（findings）+ 相关日期 + 置信度 | `query`、`years?`、`limit?` |
| `memory_batch_read_entries` | 按日期批量读取正文与元信息，返回 `entries` + `skippedDates` | `dates` |
| `memory_grep_diary` | 关键词字面匹配（仅正文），返回命中日期、摘要与上下文片段 | `keyword` |
| `memory_get_user_profile` | 读取最新年份用户画像 Markdown | — |
| `memory_get_meta_index` | 年度元索引（摘要/标签/心情/地点/字数） | `year` |

### 3.1 `memory_search`（语义检索链路）

实现：[`memory/search.ts`](../../electron/main/memory/search.ts) 的 `searchMemory()`，工具注册在 [`mcp/tools.ts`](../../electron/main/mcp/tools.ts)。

#### 输入归一化

- `query`：trim 后为空则抛错；
- `years`：过滤出 `YYYY` 格式、去重、升序；缺省或全无效时用 `listJournalYears` 检索全部年份；
- `limit`：默认 10，上限 20（`DEFAULT_DISPLAY_LIMIT` / `MAX_DISPLAY_LIMIT`）。

#### AI 客户端准备

1. `readAppConfig()` → `ensureAiSettingsReady(config)` 校验 provider/model 等配置完整，不完整抛中文错误；
2. `readAiApiKey(settings.providerType)` 读取 `secrets.json` 中的密钥，缺失抛中文错误；
3. `loadPrompt()` 并行加载三个 prompt；
4. 构建两个 client（[`ai/`](../../electron/main/ai/) 的 `createAiChatClient`）：
   - 通用 client（filter/rerank 用）：`timeoutMs` floor **60s**，失败快速暴露；
   - summarize 专用 client：`timeoutMs` floor **180s**，因为可能承载最多 20 篇正文。

#### 第一阶段：候选筛选（filter）

- 素材：`readMetaCandidates` 聚合的候选列表（只含元信息，不含正文）；
- 候选为空 → 直接返回空结果（“当前工作区没有可检索的日记”）；
- 分片并行：每 200 条候选一片（`FILTER_CHUNK_SIZE`），`Promise.all` 并行调用，prompt 为 [memory-search-filter.system.md](../../electron/main/ai/prompts/memory-search-filter.system.md)；
- 候选行格式：`- {date}: 摘要: … | 心情: … | 标签: … | 地点: …`；
- LLM 返回 `{"dates":["YYYY-MM-DD"]}`（prompt 约束单次最多 30 个），解析后经**候选集合校验**（丢弃编造的日期）、去重、升序，得到 `journalListA`；
- `journalListA` 为空 → 返回空结果（“没有找到与查询相关的日记”）。

#### 第二阶段：正文精筛（rerank）

- `batchReadEntries(workspacePath, journalListA)` 读取正文（`skippedDates` 忽略，候选日期文件竞态删除时自然容错）；
- 分片并行：每 5 篇一批（`RERANK_CHUNK_SIZE`），`Promise.all` 并行调用，prompt 为 [memory-search-rerank.system.md](../../electron/main/ai/prompts/memory-search-rerank.system.md)；
- 单篇正文截断 1800 字符（`MAX_BODY_CHARS_FOR_RERANK`，此阶段只需判断相关性）；
- LLM 返回 `{"results":[{"date","score","reason"}]}`，解析时校验日期格式、`score` 必须为整数并 clamp 到 0-100、`reason` trim；
- 保留 `score >= 60`（`RERANK_MIN_SCORE`），按分数降序、去重，得到 `journalListB`；
- `journalListB` 为空 → 返回空结果。

#### 第三阶段：结果整理（summarize）

- `displayedDates = journalListB.slice(0, limit)`；**全部入选篇目**（跟随 `limit`，最多 20 篇）进入总结；
- 单篇正文截断 10000 字符（`MAX_BODY_CHARS_FOR_SUMMARY`），尽可能保留细节；
- 单次调用 summarize client，prompt 为 [memory-search-summarize.system.md](../../electron/main/ai/prompts/memory-search-summarize.system.md)；
- LLM 返回 `{"answer":"...","findings":["..."],"confidence":"high"}`：
  - `answer` 为空字符串 → 抛错（进入降级）；
  - `findings` 归一化：只保留非空字符串、trim；
  - `confidence` 只接受 `high/medium/low`，其他值回退 `medium`。

#### JSON 解析与降级策略

- 三个阶段的 LLM 返回统一走 `extractJsonObject`：先 `JSON.parse`，失败则用正则 `\{[\s\S]*\}` 提取首个 JSON 对象兜底，再失败抛错；
- **降级**：summarize 阶段抛错（超时/解析失败/空回答）时，不向上抛错，而是返回降级结果——`relatedDates` 全保留、`answer` 说明失败原因并引导调用方用 `memory_batch_read_entries` 自助阅读原文、`findings: []`、`confidence: 'low'`。前两个阶段的成果不被浪费；
- filter/rerank 阶段抛错（AI 故障等）不设降级，直接作为工具错误返回（`isError: true`）。

#### 人称约定

日记以第一人称“我”书写，查询与输出统一使用第三人称“用户”：filter/rerank prompt 中有身份映射说明（“查询中的‘用户’与日记中的‘我’是同一人”），summarize prompt 明确“回答的读者是另一个 AI 助手，提到日记作者一律称‘用户’，禁用‘你’”；工具 description 与 `query` 入参示例也引导调用方用第三人称或省略主语。

#### 输出结构

```ts
interface MemorySearchResult {
  query: string
  answer: string // 详尽回答，保留细节
  findings: string[] // 与查询沾边但不直接回答查询的有趣发现
  relatedDates: string[]
  displayedCount: number
  totalCount: number
  confidence: 'high' | 'medium' | 'low'
}
```

### 3.2 `memory_batch_read_entries`

实现：[`memory/retrieval.ts`](../../electron/main/memory/retrieval.ts) 的 `batchReadEntries()`。

- 入参 `dates` 先去重（`uniqDates`），逐个校验 `YYYY-MM-DD` 格式，**无效格式计入 `skippedDates`**；
- 文件路径由 [`resolveJournalEntryFilePath()`](../../electron/main/workspace/paths.ts) 解析为 `journal/YYYY/MM/YYYY-MM-DD.md`；
- 经 [`readJournalDocument()`](../../electron/main/journal/document.ts) 解析（容错处理 BOM/CRLF/缺失 frontmatter）：
  - 文件不存在（ENOENT）→ 计入 `skippedDates`，继续处理其余日期；
  - 其他 IO 异常 → 直接抛出（作为工具错误返回）；
- 返回 `{ entries, skippedDates }`，两者均按日期升序；`entries` 元素为 `{ date, summary, body, mood, tags }`；
- 调用方可据此区分“当天没写日记”与“日期传错了”，无需猜测。

### 3.3 `memory_grep_diary`

实现：[`memory/retrieval.ts`](../../electron/main/memory/retrieval.ts) 的 `grepDiaryText()`。

- `keyword` trim 并 `toLocaleLowerCase`，为空返回 `[]`；匹配大小写不敏感；
- 遍历 `journal/YYYY/MM/*.md`（年份、月份、文件名均排序，结果天然按时间升序）；
- 每个文件用 `readJournalDocument()` 解析，**只在 body 正文内匹配**，frontmatter（weather/location/mood/summary 等）不参与；读取失败的文件跳过；
- 单文件最多 3 条命中（`MAX_GREP_MATCHES_PER_FILE`），全局上限 50 条（`MAX_GREP_MATCHES`），达到上限即停止遍历；
- 片段截取：命中位置前后各 60 字符（`SNIPPET_CONTEXT_CHARS`），连续空白折叠为单空格，首尾按需加省略号 `…`；
- 返回 `{ date, summary, snippet }[]`——`summary` 取自该篇 frontmatter，调用方无需回查元索引即可判断相关性；
- 纯本地字面匹配，不依赖 AI。

### 3.4 `memory_get_user_profile`

实现：[`memory/retrieval.ts`](../../electron/main/memory/retrieval.ts) 的 `getUserProfile()`。

- 扫描 `<workspace>/.dairy/user-profile/` 下匹配 `user-profile-YYYY.md` 的文件，取**最新年份**读取，返回 `{ year, content }`；
- 目录不存在或最新年份读取失败 → 只读回退 legacy 文件 `<workspace>/.dairy/user-profile.md`（返回 `year: null`）；
- 两者都没有 → 返回 `{ year: null, content: '' }`，不抛错；
- 画像的生成与维护机制见 [user-profile.md](user-profile.md)。

### 3.5 `memory_get_meta_index`

实现：[`memory/retrieval.ts`](../../electron/main/memory/retrieval.ts) 的 `getMetaIndex()` → [`journal/meta-index.ts`](../../electron/main/journal/meta-index.ts) 的 `readJournalMetaIndex()`。

- 读取 `<workspace>/journal/YYYY/journal-meta.json`，文件不存在返回 `null`；
- 返回完整的 `JournalMetaIndex`（定义见 [`src/types/journal.ts`](../../src/types/journal.ts)）：

```ts
interface JournalMetaIndex {
  version: 1
  year: string
  updatedAt: string
  entries: Record<string, JournalMetaEntry> // key 为 "MM-DD"
}

interface JournalMetaEntry {
  createdAt: string
  updatedAt: string
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
  wordCount: number
}
```

- 该文件由日记保存链路增量维护，也可全量重建；适合先概览一年再决定精读哪些日期；
- 入参 `year` 在工具层经 zod 校验必须为 `YYYY` 格式。

### 3.6 公共约定

- **工作区解析**（[`mcp/tools.ts`](../../electron/main/mcp/tools.ts) 的 `resolveWorkspacePath`）：显式 `workspacePath`（trim 后非空）优先，缺省回退 `config.lastOpenedWorkspace`，两者都没有返回中文错误；
- **结果包装**：成功结果 `JSON.stringify(data, null, 2)` 作为 text content；工具内异常捕获后以 `isError: true` 返回中文错误文本，不击穿服务；
- **只读边界**：读工具（`memory_*`）不暴露写操作与敏感配置（明文 key）；写操作仅限「二、写工具详解」列出的工具。

---

## 四、MCP 服务（`electron/main/mcp/`）

| 文件 | 职责 |
|------|------|
| [`tools.ts`](../../electron/main/mcp/tools.ts) | 工具注册与工作区解析（`createMemoryMcpServer`） |
| [`server.ts`](../../electron/main/mcp/server.ts) | HTTP 服务与生命周期（start/stop/status） |
| `index.ts` | 统一导出 |

### 4.1 协议与传输

- 官方 `@modelcontextprotocol/sdk`，`McpServer.registerTool` + zod 入参；
- Streamable HTTP transport，**stateless 模式**（`sessionIdGenerator: undefined`）：每个请求独立创建 server + transport，响应关闭即释放；
- 仅监听 `127.0.0.1`，端点固定 `/mcp`，连接地址为 `http://127.0.0.1:{port}/mcp`。

### 4.2 进程模型

- **不启动新进程**：MCP 服务是 Electron 主进程内创建的 `http.Server`（[`server.ts`](../../electron/main/mcp/server.ts) 中 `http.createServer`），与主进程共享同一个 Node.js 进程与事件循环，只是多监听一个回环端口；
- 每个 MCP 请求创建的 `McpServer` + transport 是进程内 JS 对象，响应关闭即释放，无常驻开销；
- 处理 MCP 请求时的文件读取、AI 检索调用（`memory_search` 的 LLM 请求）全部在主进程内发起——与“AI 请求只能由主进程发起、密钥不出主进程”的架构约束天然一致；
- 请求处理均为异步 IO，不会阻塞主进程事件循环，也不影响渲染进程 UI；
- 连接进来的是外部 AI 工具自己的进程（如 OpenCode），它们与 dAiry 之间只通过 HTTP 交互。

### 4.3 生命周期

- 应用启动：`config.mcp.enabled` 为 true 时按 `config.mcp.port` 启动，失败只记运行态，不阻塞窗口创建；
- 设置变更：先持久化配置，再按最新配置启停（[`ipc/mcp.ts`](../../electron/main/ipc/mcp.ts) 串行执行）；
- 端口变化：旧服务先停再启；同端口重复 start 幂等返回；
- 应用退出：`before-quit` 时停止服务；`closeAllConnections()` 防止 keep-alive 连接卡住退出；
- start/stop 内部 promise 链串行化，防快速切换竞态。

运行态（不持久化）：

```ts
interface McpRuntimeStatus {
  status: 'stopped' | 'running' | 'error'
  port: number | null
  errorMessage: string | null
}
```

超时说明：服务端各阶段 AI 调用超时见 §3.1；MCP **客户端侧**默认请求超时（常见为 60s）不受服务端控制，`memory_search` 的 description 已如实说明耗时较长，调用方客户端可能需要调大超时配置。

---

## 五、配置与 IPC

配置（`config.json` 顶层）：

```json
{
  "mcp": {
    "enabled": false,
    "port": 9123
  }
}
```

- `port` 归一化：整数且 1024-65535，否则回退 9123；
- IPC 仅两个通道：`app:set-mcp-preference`（写配置并启停服务）、`app:get-mcp-runtime-status`（查运行态）；
- `getBootstrap` 返回持久化的 `config.mcp`；运行态不混入持久化配置模型。

---

## 六、设置页

- 设置页「MCP 服务」分区：开关、端口输入（失焦保存）、运行状态（运行中/已停止/启动失败 + 错误信息）、连接地址展示；
- 保存流程：`setMcpPreference` → 同步配置状态 → `getMcpRuntimeStatus` 刷新运行态 → 按结果给出中文提示；
- 启动失败（端口占用/权限不足）在设置页展示明确中文错误，不自动重试。
