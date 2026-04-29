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

- 写作 / 报告 / 设置 三大主视图
- 工作区选择、月历、日期切换、历史浏览
- Markdown 编辑与预览
- Frontmatter 元信息编辑：`weather`、`location`、`mood`、`summary`、`tags`
- 手动保存、快捷保存、未保存保护
- 关闭窗口时可配置为直接退出或最小化到系统托盘
- “自动整理”生成 `summary + tags`，但默认只回填前端草稿
- 区间报告生成、历史列表读取、JSON 落盘
- 报告 section：`stats`、`heatmap`、`moodTrend`、`tagCloud`、`highlights`、`locationPatterns`、`timePatterns`
- 报告 PNG 导出：专用导出页面 + 主进程截图链路

当前优先级：

- 持续打磨 V1 写作主流程
- 提升区间总结与报告展示质量
- 保持导出和 AI 能力为辅助，不干扰正文写作

## 4. 架构边界

- 渲染进程负责 UI、编辑、预览、交互态状态
- 主进程负责文件读写、配置、AI、Git、报告生成、导出
- `preload` 只暴露最小且明确的 API，保持可审计
- 本地 Markdown 是唯一事实源，报告 JSON 和导出 PNG 都是派生物
- AI 失败不能影响保存；Git 失败不能影响保存；导出失败不能影响已有报告和日记
- 渲染进程不能直接访问文件系统，也不能直接持有明文敏感信息
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
  reports/
  .dairy/
    workspace.json
    tags.json
    weather.json
    locations.json
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

配置分层：

- 工作区配置：`<workspace>/.dairy/workspace.json`
- 应用配置：`<userData>/config.json`
- 密钥配置：`<userData>/secrets.json`

当前应用配置（`config.json`）中的 UI 配置除主题、缩放等外，还包含关闭窗口行为、窗口状态（窗口化时的尺寸/位置、是否最大化/全屏）、通知提醒时间与“开机自启”开关；默认应优先保持“关闭窗口最小化到托盘”和“开机自启开启”的桌面工具体验。

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
- 生成区间报告时，允许补做缺失的日级 insight，但只写入本次报告 JSON，不回写原始 Markdown

Git 约束：

- 只对用户日记目录执行，不对本项目源码仓库执行
- 不要对整个应用目录执行 `git add .`
- Git 是可选能力，并且应异步执行

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

## 8. UI 与主题

整体方向：`modern / clean / calm / structured / airy`

UI 原则：

- 写作体验优先，AI 感低强调
- 更接近本地桌面工具，不要做成宣传页或云平台后台
- 左侧以工作区和月历为主，右侧编辑区是视觉中心

样式约束：

- 优先复用 `src/shared/theme/tokens.css` 聚合的 token，不要在业务组件中硬编码颜色、阴影、渐变
- 若 token 不足，先补 token，再在组件中使用
- `html[data-theme='dark']` 是深色主题正式覆盖入口
- 导出页、图表、滚动条、悬浮态、选中态也走主题体系
- `base.css` 只放全局基础规则，不承载业务组件样式

## 9. 对 Codex 的要求

- 优先小步、可验证、可回退的改动
- 默认使用 `TypeScript`
- 保持渲染进程 / preload / 主进程边界清晰
- `preload` API 必须显式、收敛、可审计
- 用户可见文案优先简洁中文
- 只在复杂逻辑处写必要的中文注释
- 不要提前引入数据库、重量级状态管理或重量级编辑器
- 若你的改动改变了稳定约定、目录职责或核心链路，请同步更新本文件
