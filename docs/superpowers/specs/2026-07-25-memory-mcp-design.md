# dAiry 记忆系统重构与 MCP 开关设计文档

## 概述

本设计用于支持 dAiry 的新定位：应用本体保持轻量写作体验，AI 对话能力由外部 agent（如 OpenCode、Claude Code）承载；dAiry 负责提供稳定、可检索、可总结的本地记忆能力，并通过 MCP 暴露。

本期目标分两层：

1. 先重构记忆系统，形成统一的主进程能力层；
2. 在设置页新增 MCP 手动开关，按需启动/关闭 MCP 服务。

核心原则：

- 本地 Markdown 仍是唯一事实源；
- AI 失败不能影响写作与保存；
- 不引入重型索引系统，优先复用现有 `journal-meta.json` 和短文本正文特性；
- 设计需便于后续扩展 MCP tool，不强耦合 UI。

---

## 一、目标与边界

### 1.1 目标

- 提供统一的 `memory` 模块，承载检索、总结、画像读取等能力；
- 实现端到端语义检索：`query -> 候选日期 -> 精筛正文 -> 结构化总结`；
- 设置页支持 MCP 服务开关（手动启停、状态可见、端口可配置）；
- 为后续 SKILL 编写提供稳定工具语义。

### 1.2 非目标（本期不做）

- 内置聊天 UI；
- 向量数据库/实体知识图谱；
- 云端存储与账号体系；
- 自动在后台长期运行 MCP（必须用户可控开关）；
- 报告 JSON 结构改版。

---

## 二、总体架构

### 2.1 结构分层

- `electron/main/memory/`：记忆域核心模块（新增）
- `electron/main/mcp/`：MCP 服务启动与工具路由（新增）
- `electron/main/ipc/mcp.ts`：MCP 偏好与运行状态 IPC（新增）
- `electron/main.ts`：应用生命周期入口（接入 MCP 启停，修改）
- `src/components/settings/`：MCP 配置 UI（修改）
- `src/types/*` + `src/shared/ipc-channels.ts`：跨层类型与通道定义（修改）

记忆域输入输出类型就近放在 `electron/main/memory/types.ts`，不进入 `src/types/`；`src/types/` 只新增 MCP 偏好与运行状态等跨进程类型。

### 2.2 设计选择

- 复用现有数据资产：
  - 用户画像：`<workspace>/.dairy/user-profile/user-profile-YYYY.md`（按年版本，读取时取最新年份，兼容 legacy `user-profile.md`）
  - 年度元索引：`<workspace>/journal/<YYYY>/journal-meta.json`
  - 日记正文：`journal/YYYY/MM/YYYY-MM-DD.md`
  - 年度时间轴：`<workspace>/timeline/<YYYY>.json`
- 不新增语义索引文件；
- 检索阶段以 LLM 编排为主，纯本地扫描为辅（grep/tooling）。

---

## 三、记忆系统设计

### 3.1 模块职责

建议新增目录：

```text
electron/main/memory/
  index.ts
  types.ts
  retrieval.ts
  search.ts
```

- `retrieval.ts`：数据访问与基础查询（批量读取、grep、meta 读取）；
- `search.ts`：语义检索编排（多步 LLM 逻辑）；
- `types.ts`：记忆工具输入输出类型；
- `index.ts`：对外统一导出。

### 3.2 核心能力清单

- `searchMemory(input)`：语义检索主入口；
- `batchReadEntries(input)`：按日期批量读取正文（返回 `entries` + `skippedDates`，不静默跳过）；
- `grepDiary(input)`：按关键词/正则做全局文本匹配；
- `getUserProfile(input)`：读取画像 Markdown；
- `getMetaIndex(input)`：获取指定年份 meta 索引。

### 3.3 语义检索流程

1. **候选筛选（journalListA）**
   - 输入：用户 query + 年度 `journal-meta.json` 的 summary/tags/mood/location
   - 处理：LLM 选择可能相关日期
   - 输出：`journalListA: string[]`

2. **正文精筛（journalListB）**
   - 读取 `journalListA` 的正文全文
   - 分批并行调用 LLM，返回每篇置信度与命中理由
   - 合并去重后得到 `journalListB`

3. **结果整理**
   - 若 `journalListB` 较少：一次总结
   - 若较多：按置信度截断或分批总结再合并
   - 输出结构包含：结论文本、日期列表、展示篇数、总篇数

4. **失败降级**
   - 任一步 AI 失败时，返回可读中文错误；
   - 保留本地工具（如 grep / batchRead）可用。

### 3.4 查询结果结构

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

## 四、MCP 服务与设置开关设计

### 4.1 开关策略

- 设置页新增「MCP 服务」配置区；
- 用户手动开启后才启动 MCP；
- 用户关闭开关或应用退出时停止 MCP。

### 4.2 配置项

在应用配置（`config.json`）新增：

```json
{
  "mcp": {
    "enabled": false,
    "port": 9123
  }
}
```

约束：

- `port` 限制为 1024-65535；
- 默认仅监听 `127.0.0.1`；
- 开关状态需即时生效并持久化。

### 4.3 服务生命周期

- 应用启动：读取 `mcp.enabled`，若为 true 则尝试启动；
- 设置变更：
  - false -> true：启动服务；
  - true -> false：关闭服务；
  - 端口变化：重启服务；
- 应用退出：确保释放端口与监听器。

工程约束补充：

- 当前仓库主进程入口为 `electron/main.ts`，MCP 生命周期接入应落在该文件，不使用 `electron/main/main.ts` 路径；
- 配置写入与服务启停需串行处理（先持久化，再按最新配置执行启停），避免状态不一致。

### 4.4 协议实现

- 使用官方 `@modelcontextprotocol/sdk`，Streamable HTTP transport（无会话 stateless 模式），端点 `http://127.0.0.1:{port}/mcp`；
- 不手写 JSON-RPC 协议层，避免与各 MCP 客户端的兼容性风险；
- SDK 依赖随主进程打包（路径已被 nodemailer 验证）。

### 4.5 MCP Tool 边界（首期）

首期仅暴露记忆系统相关工具，全部只读：

- `memory_search`
- `memory_batch_read_entries`
- `memory_grep_diary`
- `memory_get_user_profile`
- `memory_get_meta_index`

约定：

- 工具名使用下划线风格（MCP 规范推荐 `^[a-zA-Z0-9_-]{1,64}$`，不用点号）；
- 所有工具接受可选 `workspacePath` 参数；缺省时回退到应用配置的 `lastOpenedWorkspace`，两者都没有时返回可读中文错误；
- 不暴露写操作（创建/保存日记）与敏感配置（明文 key）。

---

## 五、IPC 与 Preload 扩展

### 5.1 IPC 通道（新增）

- `app:set-mcp-preference`
- `app:get-mcp-runtime-status`

约定：

- `getBootstrap` 继续返回持久化配置（含 `config.mcp`）；
- 运行态（running/stopped/error）通过 `app:get-mcp-runtime-status` 单独查询，避免把瞬时状态混入持久化配置模型。

### 5.2 memory 能力不暴露渲染层

本期 memory 模块只面向主进程内部与 MCP 层：

- MCP server 运行在主进程内，直接 `import` memory 模块函数，不经过 IPC；
- dAiry 自身界面暂无检索/批读消费方，因此不新增 `memory:*` IPC 通道与 preload API；
- 后续若界面需要检索能力，再按需补充 `memory:search` 等通道。

### 5.3 Preload API

仅新增 `setMcpPreference` 与 `getMcpRuntimeStatus` 两个方法，参数均为可结构化克隆对象。

---

## 六、错误处理与用户体验

- MCP 启动失败（端口占用/权限不足）时：
  - 设置页展示明确中文错误；
  - 不影响写作与其他功能；
  - 不自动无限重试。
- 语义检索失败时：
  - 返回中文错误 + 建议（如缩小年份范围、改关键词）；
  - 提供可回退到 grep 的路径。

---

## 七、验证策略

- 类型检查：新增类型与 API 接口不破坏现有编译；
- 功能验证：
  - 检索命中基本正确（抽样 query）；
  - MCP 开关可开关，端口变更生效；
  - 关闭应用后端口释放。
- 回归重点：
  - 自动整理/画像维护/报告生成链路无回归；
  - 保存流程不被 MCP 和检索逻辑阻断。

---

## 八、里程碑

1. M1：完成 `memory` 模块（retrieval + 语义检索编排）；
2. M2：完成设置页 MCP 开关与主进程服务生命周期；
3. M3：完成 MCP 工具映射与联调；
4. M4：补齐 SKILL 文档与示例流程。
