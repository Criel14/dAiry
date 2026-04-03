# dAiry AGENTS Guide

本文件用于指导 Codex 和其他协作者在当前仓库中工作。

---

## 1. 项目定位

`dAiry` 是一个面向程序员的本地桌面日记工具。

产品目标：

- 在桌面应用中编写和管理 Markdown 日记
- 数据保存在用户自定义目录，而不是项目仓库内
- AI 提供摘要、标签、月总结等辅助能力
- Git 作为可选备份方式

不需要完成：

- 通用日记平台
- 零配置即开即用的云产品
- 多端同步
- 提前扩展复杂富文本能力

核心体验目标：

- 第一感受是“顺手的写作工具”
- 第二感受才是“它可以帮我总结”
- UI 要降低写作压力，而不是强调功能堆叠

---

## 2. 当前仓库现状

当前项目是通过脚手架创建的 Electron + Vue + Vite + TypeScript 工程，开发时必须以现有目录结构为主，不要先做目录大重构。

当前实际目录结构：

```text
dAiry/
  src/
    main.ts
    App.vue
    style.css
    assets/
    components/

  electron/
    main.ts
    preload.ts
    electron-env.d.ts

  public/
  index.html
  vite.config.ts
  electron-builder.json5
  package.json
  tsconfig.json
  tsconfig.node.json
```

目录职责：

- `src/`：渲染进程代码，负责界面、状态、交互
- `electron/main.ts`：Electron 主进程入口
- `electron/preload.ts`：渲染进程与主进程之间的安全桥接层
- `public/`：静态资源
- `vite.config.ts`：Vite 与 Electron 集成配置
- `electron-builder.json5`：桌面应用打包配置

重要约束：

- 以当前结构继续演进，不要擅自改成 `src/renderer + src/main + src/preload`
- 如果后续功能增多，可以在现有根目录下逐步细分子目录
- 当前仓库仍带有脚手架示例内容，新增功能时应逐步替换，而不是围绕 demo 长期叠加

---

## 3. 常用命令

优先使用 `npm`，因为仓库当前存在 `package-lock.json`。

可用命令：

- `npm run dev`
  启动 Vite 开发环境，并通过 `vite-plugin-electron` 拉起 Electron
- `npm run build`
  执行 `vue-tsc && vite build && electron-builder`
- `npm run preview`
  仅预览渲染进程构建结果

当前没有现成的 `test` 或 `lint` 脚本。若后续新增，应及时同步更新本文件。

---

## 4. 生成产物与不要手改的内容

以下目录或文件属于构建产物或打包输出，不应作为业务源码手工维护：

- `dist/`
- `dist-electron/`
- `release/`

规则：

- 除非在排查构建问题，否则不要直接编辑这些输出文件
- 业务改动应优先落在 `src/`、`electron/`、配置文件和资源文件中
- 如果构建产物与源码不一致，应修改源码后重新构建，而不是直接修补产物

---

## 5. 当前阶段的开发优先级

优先实现 V1，不提前展开 V2/V3。

V1 目标：

- 今日页
- 历史页
- 设置页
- Markdown 编辑与预览
- 手动保存或自动保存
- 选择用户日记目录
- 基于本地文件系统读写日记

V2 再做：

- 一键生成摘要 `summary`
- 一键提取标签 `tags`
- 一键生成月度总结

V3 可选：

- Git 状态检测
- 手动同步
- 自动同步

---

## 6. 架构原则

技术选型：

- 桌面壳：`Electron`
- 前端界面：`Vue 3 + Vite`
- 主进程：`Node.js + TypeScript`
- 存储：`Markdown`
- AI：`BYOK`
- 备份：调用本机 `git`

核心原则：

- 渲染进程负责编辑、预览、列表、设置等 UI 能力
- 主进程负责文件读写、配置管理、AI 调用、Git 调用
- `preload` 只暴露最小且明确的安全接口
- 本地 Markdown 文件是唯一主数据源
- AI 和 Git 都不能阻塞“保存正文”主流程
- 渲染进程不能直接访问文件系统，也不能直接持有敏感配置

建议运行模型：

```text
[Vue Renderer]
    |
    | invoke / contextBridge
    v
[Preload]
    |
    v
[Electron Main]
    |-- 文件系统
    |-- 本地配置
    |-- AI 调用
    |-- Git 备份
```

---

## 7. 数据与目录规则

应用代码和用户数据必须分离。

用户首次启动后应选择一个日记目录，例如：

- `D:\journal-data`
- `~/journal-data`

推荐数据结构：

```text
journal-data/
  entries/
    2026/
      04/
        2026-04-02.md
  reports/
    2026/
      2026-04.md
  .dairy/
    workspace.json
```

单篇日记建议使用 Markdown + Frontmatter，例如：

```md
---
date: 2026-04-02
title: ""
mood: 3
tags: []
summary: ""
updatedAt: "2026-04-02T22:30:00+08:00"
ai:
  status: "idle"
  model: ""
git:
  synced: false
---

今天的正文内容...
```

关键规则：

- 本地文件写入成功才算保存成功
- AI 失败不能影响正文保存
- Git 失败不能影响正文保存

---

## 8. 配置管理方案

dAiry 采用“三层配置”方案，分别管理工作区配置、应用配置和敏感密钥。正式产品配置不依赖环境变量，统一通过本地配置体系管理。

### 8.1 工作区配置

工作区配置与“用户打开的笔记目录”绑定，存放在：

```text
<journalDir>/.dairy/workspace.json
```

作用：

- 描述当前笔记目录本身的结构和偏好
- 让同一个笔记目录在不同机器上仍能保留一致的组织方式
- 允许用户单独备份或迁移自己的日记目录

适合放在工作区配置中的内容：

- 工作区名称
- `entries`、`reports` 等子目录名
- Git 是否启用
- 工作区级别的写作偏好
- 与当前日记目录强相关的元数据

不应放在工作区配置中的内容：

- `apiKey`
- OAuth token
- 其他敏感凭据
- 仅对当前设备有效的窗口状态或应用外观设置

推荐示例：

```json
{
  "version": 1,
  "name": "My Journal",
  "journal": {
    "entriesDir": "entries",
    "reportsDir": "reports"
  },
  "git": {
    "enabled": true
  }
}
```

### 8.2 应用配置

应用配置与 dAiry 应用本身绑定，存放在 Electron `app.getPath('userData')` 目录下，例如：

```text
<userData>/config.json
```

作用：

- 保存当前设备上的应用级设置
- 管理最近打开目录、窗口状态、主题等本机信息
- 保存 AI 的非敏感配置

适合放在应用配置中的内容：

- 最近打开的工作区列表
- 上次打开的工作区路径
- 主题、语言、窗口状态
- 默认 AI provider
- `baseURL`
- `model`

推荐示例：

```json
{
  "lastOpenedWorkspace": "D:\\journal-data",
  "recentWorkspaces": [
    "D:\\journal-data"
  ],
  "ui": {
    "theme": "system"
  },
  "ai": {
    "provider": "openai",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4.1-mini"
  }
}
```

### 8.3 密钥配置

敏感信息与普通应用配置分离，单独存放在 `userData` 目录下，例如：

```text
<userData>/secrets.json
```

规则：

- 只保存敏感信息
- 不保存明文 `apiKey`
- 使用 Electron `safeStorage` 在主进程中加密后再写盘
- 渲染进程不直接读取明文密钥
- preload 只暴露“是否已配置密钥”或“保存密钥”的受控接口

推荐示例：

```json
{
  "ai": {
    "encryptedApiKey": "BASE64_ENCRYPTED_VALUE"
  }
}
```

### 8.4 运行时读取顺序

运行时遵循以下顺序：

1. 读取应用配置 `config.json`
2. 恢复上次打开的工作区，或提示用户选择目录
3. 读取当前工作区的 `.dairy/workspace.json`
4. 调用 AI 前，从 `secrets.json` 中读取并解密 `apiKey`

约束：

- `baseURL`、`model` 等非敏感项从应用配置读取
- `apiKey` 只从密钥配置读取
- 工作区配置不负责保存敏感凭据
- 前端只获取脱敏后的状态，例如 `hasApiKey: true`

### 8.5 设计原则

- 配置按职责分层，不混用
- 工作区可迁移，应用配置本机化，密钥独立管理
- 敏感信息永远不进入用户笔记目录
- 渲染进程不直接持有明文密钥
- 所有配置读写应优先由主进程负责

---

## 9. AI 与 Git 约束

AI 接入规则：

- 采用 `BYOK`
- API Key 只保存在本机密钥配置中
- 渲染进程永远不直接持有 Key
- AI 请求只能由主进程发起
- 结果应先给用户预览，再由用户确认写入

Git 备份规则：

- Git 只对“用户日记目录”执行操作，不对项目源码目录执行备份逻辑
- 不要对整个应用目录执行 `git add .`
- 不要把代码仓库和数据仓库混在一起
- Git 必须作为可选能力，并且异步执行

推荐流程：

```bash
git add entries/2026/04/2026-04-02.md
git commit -m "backup: 2026-04-02"
git push origin main
```

---

## 10. 对 Codex 的具体工作要求

这是本文件最重要的执行部分。

### 10.1 改动原则

- 优先做小步、可验证、可回退的改动
- 优先延续当前工程结构，不做超前重构
- 如果现有脚手架已经能承载目标功能，先在现有基础上实现
- 除非用户明确要求，否则不要大规模改目录

### 10.2 代码约束

- 使用 `TypeScript`
- 保持渲染进程和主进程边界清晰
- `preload` 中暴露的 API 需要显式、收敛、可审计
- 仅在复杂逻辑处加入必要的中文注释，不要堆砌注释
- 用户可见文案优先使用简洁中文
- 不为了“看起来完整”提前引入数据库、状态管理库或重量级编辑器

### 10.3 配置联动

如果修改以下部分，要注意同步：

- 修改 Electron 入口或 preload 入口时，需要同步检查 `vite.config.ts`
- 修改打包行为时，需要同步检查 `electron-builder.json5`
- 修改渲染进程与 preload 的接口时，需要同步检查调用侧与类型定义
- 如果新增了稳定的开发命令、脚本或目录约定，需要同步更新本文件

### 10.4 当前仓库中的已知事实

- 当前脚手架示例组件仍然存在，例如 `src/components/HelloWorld.vue`
- `electron-builder.json5` 仍含有脚手架默认值，例如 `appId` 和 `productName`
- `README.md` 目前内容很少，后续如果项目结构稳定，可以补充面向人类用户的使用说明

---

## 11. 启动与分发目标

目标形态是本地桌面应用，而不是“本地服务 + 浏览器页面”。

首次启动理想流程：

1. 读取应用配置
2. 若未配置 `journalDir`，提示用户选择目录
3. 自动创建目录结构
4. 打开主窗口并进入“今天”

用户最终应看到：

- 一个可安装、可直接运行的桌面应用
- 内部仍保留 `renderer + preload + main` 的职责分层

发布时：

- 先构建渲染进程资源
- 再构建 Electron 主进程与 preload
- 最后通过 `electron-builder` 打包

如果进入正式发布阶段，记得补全应用签名、`appId`、`productName` 等打包元数据。

---

## 12. UI 风格指导

`dAiry` 的视觉方向应偏向：

- modern
- clean
- calm
- structured
- airy

风格要求：

- 不做传统纸张拟物风格
- 不做强烈 AI 科幻感
- 不做明显食品品牌风格
- 写作体验优先，AI 感存在但不抢主角

布局建议：

- 左侧：日期导航 / 月份列表 / 历史入口
- 右侧：Markdown 编辑区

布局原则：

- 编辑区始终是视觉中心
- 历史与设置入口不抢主内容注意力
- AI 区域默认低强调，仅在主动触发后增强存在感

推荐色板：

```text
Background:   #F7F7F4
Surface:      #FFFFFF
Primary:      #9ACCE3
Primary Deep: #8FB7C9
Text Main:    #2F3A40
Text Subtle:  #6B7780
Border:       #E5E8EA
Accent AI:    #B8DCCF
Success:      #79B68E
Warning:      #D5A35B
```

视觉原则：

- 避免高饱和霓虹色
- 避免纯黑纯白强对比
- 动效应轻量、克制、稳定
- 按钮、面板、输入区采用圆角，但避免过度可爱化

---

## 13. 产品与 Logo 方向

`dAiry` 来自 `diary + AI`。

产品表达应体现：

- 日常记录
- 收集内容
- 整理与沉淀
- AI 辅助总结

Logo 推荐方向：

- 首选：`牛奶盒 + 笔记页`
- 备选：`奶滴 + 文档`
- 备选：`奶盒 + 摘要线`

约束：

- 几何化
- 简洁
- 适配小尺寸
- 避免卡通吉祥物风格
- 避免过强拟物质感

品牌字标统一使用：

`dAiry`

要求保留中间 `AI` 的大写识别。

---

## 14. 一句话总结

这是一个基于 `Electron + Vue 3 + Vite + TypeScript` 的本地桌面日记工具：当前仓库以脚手架生成的实际目录结构为准，优先完成本地 Markdown 写作体验，再逐步增加 AI 辅助与可选 Git 备份，同时始终保持“本地优先、写作优先、主流程稳定优先”。
