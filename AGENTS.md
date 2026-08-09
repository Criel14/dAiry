# dAiry AGENTS Guide

本文件用于让首次接手仓库的模型或协作者，快速理解项目目标、关键边界和高价值约束。原则：只保留影响判断和实现方向的信息。

## 1. 项目一句话

`dAiry` 是一个面向程序员的本地桌面日记工具，强调本地 Markdown 写作体验，AI 只做辅助，Git 只是可选增强。

- 核心目标：本地写作、工作区目录读写、AI 辅助摘要/标签/区间总结、可选 Git 备份
- 非目标：云平台、多端同步、复杂富文本、为了“完整”而提前扩展
- 一句话原则：本地优先、写作优先、主流程稳定优先

## 2. 技术栈与目录

技术栈：`Electron + Vue 3 + Vite + TypeScript`

主要目录：

- `src/`：渲染进程 UI
- `src/app/`：应用壳层与页面级组合逻辑
- `src/components/journal/`：日记主流程
- `src/components/report/`：报告与导出相关 UI
- `src/components/settings/`：设置页
- `src/components/workspace/`：工作区侧栏
- `src/shared/`：跨业务共享逻辑
- `src/shared/theme/`：主题 token、全局基础样式、主题入口
- `src/types/`：共享类型
- `electron/main/`：主进程模块
- `electron/main/report/`：报告生成、读取、列表
- `electron/main/report-export/`：报告 PNG 导出
- `electron/main/bills/`：记账数据访问（db/categories/service/export）
- `electron/main/memory/`：记忆检索能力（retrieval、语义检索编排，供 MCP 与主进程内部使用，不经 IPC 暴露渲染层）
- `electron/main/mcp/`：MCP 服务生命周期与工具映射
- `electron/preload.ts`：受控桥接 API

目录约定：

- 保持按业务域组织，不要重构成 `src/renderer + src/main + src/preload`
- `.vue` 与其专属 `.css` 优先同目录放置
- 仅在真实跨业务复用时才放到 `src/shared/`
- 主题值集中维护在 `src/shared/theme/tokens/`，并由 `src/shared/theme/tokens.css` 统一聚合
- `dist/`、`dist-electron/`、`release/` 不作为源码维护

常用命令：

- `npm run dev`
- `npm run build`
- `npm run preview`
- Windows 下执行 `npm` 相关命令时，优先通过 `cmd` 而不是 `powershell`

## 3. 当前产品状态

当前已具备：

- 写作 / 报告 / 设置 三大主视图（外加工作区视图，承载目录选择与打开）
- 工作区选择、月历、日期切换、历史浏览
- Markdown 编辑与预览
- Frontmatter 元信息编辑：`weather`、`location`、`mood`、`summary`、`tags`
- 手动保存、快捷保存、未保存保护
- 关闭窗口时可配置为直接退出或最小化到系统托盘
- “自动整理”生成 `summary + tags`，但默认只回填前端草稿
- 区间报告生成、历史列表读取、JSON 落盘
- 报告 section：`stats`、`heatmap`、`moodTrend`、`tagCloud`、`highlights`、`locationPatterns`、`timePatterns`
- 报告 PNG 导出：专用导出页面 + 主进程截图链路
- 记账：月度明细/统计视图、录入编辑删除、分类库（内置+自定义）、导出 Excel（sheet 按年份）

当前优先级：

- 持续打磨 V1 写作主流程
- 提升区间总结与报告展示质量
- 保持导出和 AI 能力为辅助，不干扰正文写作
- 记账主流程（录入/浏览/统计/导出）稳定可用

## 4. 架构边界

- 渲染进程负责 UI、编辑、预览、交互态状态（记账：记账 UI 与统计聚合）
- 主进程负责文件读写、配置、AI、Git、报告生成、导出（记账：账单读写（SQLite）、分类库、Excel 导出）
- `preload` 只暴露最小且明确的 API，保持可审计
- 本地 Markdown 是唯一事实源，报告 JSON 和导出 PNG 都是派生物
- AI 失败不能影响保存；Git 失败不能影响保存；导出失败不能影响已有报告和日记
- 渲染进程不能直接访问文件系统，也不能直接持有明文敏感信息
- 记账纯逻辑（分类解析/聚合/格式化）在 src/shared/bills-logic.ts，主进程与渲染进程共享
- IPC / preload 传参必须是可结构化克隆的普通对象，不要直接传 Vue 响应式对象

联动修改时注意：

- 改 Electron 入口或 preload 时，同步检查 `vite.config.ts`
- 改打包行为时，同步检查 `electron-builder.json5`
- 改 preload API 时，同步更新调用侧与共享类型
- 改主题切换逻辑时，同步检查 `src/shared/theme.ts` 与 `src/shared/theme/`
- 若新增稳定约定，记得同步更新本文件

## 5. 数据与配置

推荐工作区结构：

```text
workspace/
  journal/YYYY/MM/YYYY-MM-DD.md
  bills/bills.db
  reports/
  .dairy/
    workspace.json
    tags.json
    weather.json
    locations.json
    bill-categories.json
    user-profile.md
    supplement.md
```

当前 Frontmatter 约定：

```md
---
createdAt: ""
updatedAt: ""
weather: ""
location: ""
mood: 0
summary: ""
tags: []
---
```

关键规则：

- 用户选择的是工作区根目录，不是 `journal/` 子目录
- 本地文件写入成功才算保存成功
- 不要假设存在 `date`、`title`、`git` 等额外字段
- `mood` 为 `-5` 到 `5` 的整数，默认 `0`
- 记账数据存 `<workspace>/bills/bills.db`（SQLite，better-sqlite3 原生模块，打包需 asarUnpack 与 electron-builder install-app-deps）
- 分类库存 `<workspace>/.dairy/bill-categories.json`（物理删除，历史账单按金额符号兜底到对应类型「其他」样式）
- 金额以「分」整数存储（amount_cents），UI 显示保留 2 位小数
- 记账统计在前端聚合（list-year + 分类解析三步匹配），transfer 类型（理财等）不计入收支统计
- better-sqlite3 为 Electron ABI 编译产物，Node 环境（vitest）不可直接加载；db 层不写单测，纯逻辑在 src/shared/bills-logic.ts 可测

配置分层：

- 工作区配置：`<workspace>/.dairy/workspace.json`
- 应用配置：`<userData>/config.json`
- 密钥配置：`<userData>/secrets.json`

当前应用配置（`config.json`）中的 UI 配置除主题、缩放等外，还包含关闭窗口行为、窗口状态（窗口化时的尺寸/位置、是否最大化/全屏）、通知提醒时间与“开机自启”开关；默认应优先保持“关闭窗口最小化到托盘”和“开机自启开启”的桌面工具体验。

应用配置还包含 `mcp`（`enabled` + `port`，默认关闭、端口 9123）：MCP 服务的手动开关与监听端口，运行态（running/stopped/error）不持久化，通过 `app:get-mcp-runtime-status` 单独查询。

敏感信息约束：

- 非敏感 AI 配置放 `config.json`
- `apiKey` 只放 `secrets.json`
- 密钥由主进程使用 `safeStorage` 加密保存
- 渲染进程只拿脱敏状态，如 `hasApiKey`
- 不要把明文密钥写入前端状态、工作区配置或 Markdown

## 6. AI、Git、报告

AI 约束：

- 采用 `BYOK`
- AI 请求只能由主进程发起
- 结果先给用户确认，再决定是否写回
- “自动整理”当前不会自动落盘
- 生成区间报告时，允许补做缺失的日级 insight；补做成功后回填该日记的 frontmatter（`summary`/`tags`/`mood`，`updatedAt` 刷新）并同步元索引，失败只记 warning，绝不影响报告生成；补做与回填不触发画像/时间轴维护
- 区间总结采用多轮对话（主进程内会话）：轮 1 全量 digest 选焦点日（无 thinking，失败回退均匀分桶启发式），轮 2 焦点日全文成文（thinking，超时下限 180s）；每轮递增超时重试，失败回退本地统计文案
- 日总结会附带最近 N 天（`config.json` 的 `ai.dailyContextDays`）的日记摘要作为上下文
- AI 自动维护 `<workspace>/.dairy/user-profile.md` 用户画像：仅在用户点击“自动整理”成功后异步触发（日更 + 每隔 `ai.profileRefreshIntervalDays` 天全量刷新，刷新时间戳存 `workspace.json` 的 `lastProfileRefresh`）；画像文件不存在时日更自动从零创建初始画像（首次自动播种，无需手动生成）；画像对前端透明，不暴露查看入口；画像失败只记日志，绝不影响日总结返回；报告链路补做 insight 不触发画像
- 设置页提供"重新整理用户画像"：扫描全部日记按月迭代重建画像，全成功才写盘并更新 `lastProfileRefresh`；重建期间自动画像维护跳过；preload 暴露重建/取消/进度三个 API，但画像内容仍不经过 IPC

Git 约束：

- 不要对整个应用目录执行 `git add .`
- Git 是可选能力，并且应异步执行
- Commit Message 的格式是：英文前缀 + 中文内容，例如：“feat(bills): 重命名分类时同步更新历史账单”

报告约束：

- 月报 / 年报 / 自定义总结，本质上都是区间报告
- 报告保存在 `<workspace>/reports/` 下：
  - 月报：`monthly/YYYY-MM.json`
  - 年报：`yearly/YYYY.json`
  - 自定义：`custom/<reportId>.json`
- 报告 JSON 顶层至少包含：`version`、`reportId`、`preset`、`period`、`generation`、`summary`、`source`、`dailyEntries`、`sections`
- `summary.text` 必须始终存在
- AI 负责归纳文案；统计、图表数据、时间分布、标签频次等事实计算由本地代码完成

## 7. PNG 导出约束

导出定位：

- PNG 导出是展示层能力，不改变报告 JSON 的事实来源
- “生成报告”和“导出图片”是两阶段操作，不要耦合
- 导出时的 section 勾选只影响本次图片，不回写报告 JSON

实现方向：

- 不直接截图当前交互态报告页
- 使用专用导出页面 / 文档模式进行稳定排版
- 主进程创建隐藏 `BrowserWindow`，等待导出页准备完成后用 `capturePage()` 截图
- 保存文件、路径选择、异常处理全部留在主进程

关键原则：

- 如果某个 section 在报告里不存在，导出时不能凭空生成
- 导出输入应是纯数据对象，不依赖主窗口中的响应式状态
- 导出失败时返回可读中文错误，不做无限重试

通知约束：

- 写日记提醒属于辅助能力，不影响保存、写作、报告等主流程
- 通知在应用仍运行时即可生效；窗口开着或托盘驻留都可以提醒，如果用户直接退出应用，则不再提醒
- 提醒时间精确到分钟，通知由主进程调度，渲染进程只负责设置入口与状态反馈

MCP 约束：

- MCP 服务是可选能力，默认关闭；用户在设置页手动开启后才启动，关闭开关或退出应用即停止
- 协议层使用官方 `@modelcontextprotocol/sdk`，Streamable HTTP transport（stateless，每个请求独立 server + transport），仅监听 `127.0.0.1`，端点 `/mcp`
- 服务启动失败（端口占用等）只体现在运行态与设置页错误提示，不影响写作与其他功能，不做无限重试
- MCP 读工具全部只读（检索/批读/grep/画像/元索引），支持可选 `workspacePath` 参数，缺省回退 `lastOpenedWorkspace`；写工具仅三个：`dairy_write_entry`（写入 `journal/` 与合并 `.dairy/` 候选库）、`dairy_generate_report`（异步生成，落盘 `reports/`）、`dairy_read_report`（读取报告）；不暴露敏感配置；写工具工作区固定取 `lastOpenedWorkspace`，不接收 `workspacePath` 参数
- 记忆能力（`electron/main/memory/`）仅供主进程内部与 MCP 层直接调用，本期不经 IPC 暴露渲染层；后续界面需要时再补 `memory:*` 通道
- 配置写入与服务启停串行执行（先持久化，再按最新配置启停）；start/stop 内部串行化防竞态

## 8. UI 与主题

整体方向：`modern / clean / calm / structured / airy`

UI 原则：

- 写作体验优先，AI 感低强调
- 更接近本地桌面工具，不要做成宣传页或云平台后台
- 最左侧为窄图标活动栏，承载页面切换：工作区 / 写日记 / 总结报告 / 大事件时间轴 / 设置；工作区视图在侧栏展示当前目录并提供“选择工作区 / 打开文件夹”，设置页不再含工作区入口
- 左侧以工作区和月历为主，右侧编辑区是视觉中心

样式约束：

- 优先复用 `src/shared/theme/tokens.css` 聚合的 token，不要在业务组件中硬编码颜色、阴影、渐变
- 若 token 不足，先补 token，再在组件中使用
- `html[data-theme='dark']` 是深色主题正式覆盖入口
- 导出页、图表、滚动条、悬浮态、选中态也走主题体系
- `base.css` 只放全局基础规则，不承载业务组件样式

## 9. 对 Agent 的要求

- 优先小步、可验证、可回退的改动
- 默认使用 `TypeScript`
- 保持渲染进程 / preload / 主进程边界清晰
- `preload` API 必须显式、收敛、可审计
- 用户可见文案优先简洁中文
- 只在复杂逻辑处写必要的中文注释
- 不要提前引入数据库、重量级状态管理或重量级编辑器
- 若你的改动改变了稳定约定、目录职责或核心链路，请同步更新本文件
