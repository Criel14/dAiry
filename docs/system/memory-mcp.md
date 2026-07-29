# dAiry 记忆系统与 MCP 服务文档

## 概览

dAiry 的记忆系统是主进程内的统一能力层，负责把本地日记资产（正文、元索引、画像、摘要）组织成可检索、可总结的记忆能力。MCP 服务把这套能力以只读工具形式暴露给外部 AI 工具（OpenCode、Claude Code 等）。

```
外部 AI 工具 ──MCP(Streamable HTTP)──> electron/main/mcp ──直接调用──> electron/main/memory ──读取──> 工作区本地文件
```

核心原则：

- 本地 Markdown 仍是唯一事实源，记忆能力全部是只读派生；
- memory 模块不经 IPC 暴露给渲染层，仅供主进程内部与 MCP 层直接调用；
- MCP 服务默认关闭，用户在设置页手动开启，关闭开关或退出应用即停止。

---

## 一、memory 模块（`electron/main/memory/`）

| 文件 | 职责 |
|------|------|
| `types.ts` | 记忆域输入输出类型（不进 `src/types/`） |
| `retrieval.ts` | 数据访问与基础查询 |
| `search.ts` | 语义检索编排（多步 LLM 流程） |
| `index.ts` | 统一导出 |

### 1.1 retrieval 基础能力

- `searchMemory(input)`：语义检索主入口（在 `search.ts`）；
- `batchReadEntries(workspacePath, dates)`：按日期批量读取正文，返回 `{ entries, skippedDates }`，格式无效或文件缺失的日期计入 `skippedDates`；
- `grepDiaryText(workspacePath, keyword)`：仅在 body 正文内做大小写不敏感的字面匹配（frontmatter 不参与匹配），返回 `{ date, summary, snippet }[]`，上限 50 条（单文件最多 3 条）；
- `getUserProfile(workspacePath)`：取 `.dairy/user-profile/` 下最新年份画像，只读回退 legacy `user-profile.md`；
- `getMetaIndex(workspacePath, year)`：读取年度 `journal-meta.json`；
- `readMetaCandidates(workspacePath, years)` / `listJournalYears(workspacePath)`：检索候选辅助。

### 1.2 语义检索流程（`search.ts`）

1. **候选筛选**：读取年度元索引（摘要/标签/心情/地点），分片调用 `memory-search-filter` prompt，LLM 选出可能相关日期 `journalListA`；
2. **正文精筛**：批量读取 `journalListA` 正文，每 5 篇一批并行调用 `memory-search-rerank` prompt，按 0-100 相关度打分，保留 ≥60 分并降序得到 `journalListB`；
3. **结果整理**：按 `limit`（默认 10，上限 20）截断展示集，取前 8 篇调用 `memory-search-summarize` prompt 生成 `answer` 与置信度；
4. **失败降级**：AI 配置不完整时抛中文错误；无候选/无命中时返回空结果与友好提示，不抛异常。

输出结构：

```ts
interface MemorySearchResult {
  query: string
  answer: string
  relatedDates: string[]
  displayedCount: number
  totalCount: number
  confidence: 'high' | 'medium' | 'low'
}
```

---

## 二、MCP 服务（`electron/main/mcp/`）

| 文件 | 职责 |
|------|------|
| `tools.ts` | 工具注册与工作区解析（`createMemoryMcpServer`） |
| `server.ts` | HTTP 服务与生命周期（start/stop/status） |
| `index.ts` | 统一导出 |

### 2.1 协议与传输

- 官方 `@modelcontextprotocol/sdk`，`McpServer.registerTool` + zod 入参；
- Streamable HTTP transport，**stateless 模式**（`sessionIdGenerator: undefined`）：每个请求独立创建 server + transport，响应关闭即释放；
- 仅监听 `127.0.0.1`，端点固定 `/mcp`，连接地址为 `http://127.0.0.1:{port}/mcp`。

### 2.2 生命周期

- 应用启动：`config.mcp.enabled` 为 true 时按 `config.mcp.port` 启动，失败只记运行态，不阻塞窗口创建；
- 设置变更：先持久化配置，再按最新配置启停（`ipc/mcp.ts` 串行执行）；
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

### 2.3 工具清单（全部只读）

| 工具 | 说明 | 关键入参 |
|------|------|----------|
| `memory_search` | 语义检索日记，返回回答 + 相关日期 + 置信度 | `query`、`years?`、`limit?` |
| `memory_batch_read_entries` | 按日期批量读取正文与元信息，返回 `entries` + `skippedDates` | `dates` |
| `memory_grep_diary` | 关键词字面匹配（仅正文），返回命中日期、摘要与上下文片段 | `keyword` |
| `memory_get_user_profile` | 读取最新年份用户画像 Markdown | — |
| `memory_get_meta_index` | 年度元索引（摘要/标签/心情/地点/字数） | `year` |

约定：

- 所有工具接受可选 `workspacePath`，缺省回退 `config.lastOpenedWorkspace`，均无返回中文错误；
- 工具内异常捕获后以 `isError: true` 返回中文错误文本，不击穿服务；
- 不暴露写操作（创建/保存日记）与敏感配置（明文 key）。

---

## 三、配置与 IPC

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

## 四、设置页

- 设置页「MCP 服务」分区：开关、端口输入（失焦保存）、运行状态（运行中/已停止/启动失败 + 错误信息）、连接地址展示；
- 保存流程：`setMcpPreference` → 同步配置状态 → `getMcpRuntimeStatus` 刷新运行态 → 按结果给出中文提示；
- 启动失败（端口占用/权限不足）在设置页展示明确中文错误，不自动重试。
