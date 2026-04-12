# dAiry AGENTS Guide

本文件用于指导 Codex 和其他协作者在当前仓库中工作，目标是保留高价值约束，减少无关 token。

## 1. 项目定位

`dAiry` 是一个面向程序员的本地桌面日记工具。

- 核心目标：本地 Markdown 写作、工作区目录读写、AI 辅助摘要/标签/月总结、可选 Git 备份
- 非目标：通用云平台、多端同步、复杂富文本、为了“完整”而提前扩展
- 产品优先级：先做好“顺手的写作工具”，AI 是辅助而不是主角

## 2. 工程结构

技术栈：`Electron + Vue 3 + Vite + TypeScript`

主要目录职责：

- `src/`：渲染进程 UI
- `src/components/journal/`：日记主流程
- `src/components/settings/`：设置页
- `src/components/form/`：表单复用组件
- `src/components/workspace/`：工作区侧栏
- `src/types/`：共享类型
- `electron/main/`：主进程模块
- `electron/preload.ts`：安全桥接

约束：

- 继续沿用当前目录结构演进，不要擅自重构成 `src/renderer + src/main + src/preload`
- 不要重新引入 demo 风格页面
- 生成产物 `dist/`、`dist-electron/`、`release/` 不作为业务源码维护

常用命令：

- `npm run dev`
- `npm run build`
- `npm run preview`

## 3. 当前产品状态

当前已具备：

- 左侧导航 + 右侧编辑区 / 设置页
- 工作区目录选择与展示
- 自定义月历与日期切换
- 今日页 / 历史页基础流程
- Markdown 源码编辑与预览切换
- 基于 frontmatter 的天气、地点、总结、标签编辑
- “自动整理”生成 `summary + tags`
- 手动保存、快捷保存、未保存保护
- 词库维护、热力图开关、新一天开始时间设置
- AI 非敏感配置与密钥分离存储

当前优先级：

- 继续完善 V1 本地写作主流程
- 月总结属于下一阶段
- Git 同步属于可选增强

## 4. 架构与边界

- 渲染进程负责编辑、预览、设置等 UI
- 主进程负责文件读写、配置、AI、Git
- `preload` 只暴露最小且明确的受控接口
- 本地 Markdown 文件是唯一主数据源
- AI 和 Git 都不能阻塞正文保存
- 渲染进程不能直接访问文件系统，也不能直接持有敏感信息

修改联动时注意：

- 改 Electron 入口或 preload 时，同步检查 `vite.config.ts`
- 改打包行为时，同步检查 `electron-builder.json5`
- 改 preload API 时，同步更新调用侧与共享类型
- 若新增稳定命令或约定，记得同步更新本文件

## 5. 数据与配置规则

应用代码和用户数据必须分离。用户选择的是“工作区根目录”，不是 `journal/` 子目录。

推荐工作区结构：

```text
workspace/
  journal/YYYY/MM/YYYY-MM-DD.md
  .dairy/
    tags.json
    weather.json
    locations.json
    workspace.json
```

当前 Frontmatter 字段以这几个为准：

```md
---
createdAt: ""
updatedAt: ""
weather: ""
location: ""
summary: ""
tags: []
---
```

关键规则：

- 本地文件写入成功才算保存成功
- AI 失败不能影响保存
- Git 失败不能影响保存
- 不要假设已存在 `date`、`title`、`mood`、`git` 等字段

配置分层：

- 工作区配置：`<workspace>/.dairy/workspace.json`
- 应用配置：`<userData>/config.json`
- 密钥配置：`<userData>/secrets.json`

配置约束：

- 非敏感 AI 配置放 `config.json`
- `apiKey` 只放 `secrets.json`
- 密钥由主进程使用 `safeStorage` 加密保存
- 渲染进程只拿脱敏状态，如 `hasApiKey`
- 不要把明文密钥写入前端状态、工作区配置或 Markdown

## 6. AI 与 Git 约束

AI：

- 采用 `BYOK`
- AI 请求只能由主进程发起
- 结果先给用户确认，再决定是否写回
- 当前“自动整理”只回填前端草稿，不会自动落盘

Git：

- 只对用户日记目录执行，不对本项目源码仓库执行
- 不要对整个应用目录执行 `git add .`
- Git 是可选能力，并且应异步执行

## 7. 对 Codex 的要求

- 优先小步、可验证、可回退的改动
- 默认使用 `TypeScript`
- 保持渲染进程 / preload / 主进程边界清晰
- `preload` API 必须显式、收敛、可审计
- 用户可见文案优先简洁中文
- 只在复杂逻辑处写必要的中文注释
- 不要提前引入数据库、重量级状态管理或重量级编辑器
- 当前编辑器仍以纯文本写作 + 轻量 Markdown 预览为主

## 8. UI 方向

整体风格：`modern / clean / calm / structured / airy`

约束：

- 写作体验优先，AI 感低强调
- 更接近本地桌面工具，而不是宣传页或云平台后台
- 避免高饱和、强科幻、重拟物、过度渐变
- 左侧放工作区与月历，右侧保持编辑区为视觉中心

推荐色板：

```text
Background: #F6F2E8
Surface: #FFFFFF
Surface Muted: #FAF6EA
Primary: #F5EBC3
Text Main: #3D382D
Text Subtle: #8A816D
Border: #E5DCC5
Border Deep: #D9CB9F
```

## 9. 一句话原则

这是一个本地优先、写作优先、主流程稳定优先的桌面日记工具；所有实现都应服务于这个目标。
