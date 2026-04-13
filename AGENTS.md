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

- 左侧导航 + 右侧编辑区 / 报告页 / 设置页
- 工作区目录选择与展示
- 自定义月历与日期切换
- 今日页 / 历史页基础流程
- Markdown 源码编辑与预览切换
- 基于 frontmatter 的天气、地点、总结、标签编辑
- “自动整理”生成 `summary + tags`
- 手动保存、快捷保存、未保存保护
- 词库维护、热力图开关、新一天开始时间设置
- AI 非敏感配置与密钥分离存储
- 区间总结视图与历史报告列表
- 月度 / 年度 / 自定义区间报告生成与 JSON 缓存
- 已落地的报告 section：`stats`、`heatmap`、`moodTrend`、`tagCloud`、`highlights`、`locationPatterns`、`timePatterns`
- 区间总结 AI 文案生成与本地兜底摘要
- 对“有日记但缺少总结”的日期补做日级 AI insight，仅用于本次报告，不回写原始 Markdown

当前优先级：

- 继续完善 V1 本地写作主流程
- 继续打磨报告视图与区间总结质量
- 导出能力属于后续增强
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
  reports/
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
mood: 0
summary: ""
tags: []
---
```

关键规则：

- 本地文件写入成功才算保存成功
- AI 失败不能影响保存
- Git 失败不能影响保存
- 不要假设已存在 `date`、`title`、`git` 等字段
- 允许并维护 `mood` 字段，语义为 `-5` 到 `5` 的整数，默认值为 `0`

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
- 区间总结生成时允许在主进程补做缺失的日级 insight，但结果只写入报告 JSON，不回写原始 Markdown

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

## 8. 区间总结 / 报告现状与计划

目标：将月总结、年总结、自定义时间段统一为“区间总结”，产出 JSON 报告并在应用内专门视图渲染。

当前已落地：

- 主窗口中已增加一级 `报告` 视图，并提供 `本月 / 本年 / 自定义区间` 生成入口
- 报告已按预设落盘到 `<workspace>/reports/` 下，并支持历史列表读取
- 已实现 `stats`、`heatmap`、`moodTrend`、`tagCloud`、`highlights`、`locationPatterns`、`timePatterns`
- 区间总结文案会优先尝试 AI 生成，失败时回退到本地兜底摘要
- 对“有日记但缺少总结”的日期，生成报告时会按需补做日级 insight，但不改写原始日记文件

当前未做：

- PNG 导出
- 报告删除 / 重生成管理
- 更细的报告可视化与分享能力

定位约束：

- 日记 `Markdown` 仍是唯一原始事实源
- 月报 / 年报 / 自定义总结本质都是 `startDate + endDate` 的区间报告，月报和年报只是预设
- 报告是派生数据，不反向替代日记正文
- AI 负责归纳与文案，本地代码负责统计、图表数据、时间分布、标签频次等事实层计算
- 报告生成不能阻塞日记保存，失败不能影响已有日记

页面组织：

- 不单独开业务新窗口，统一放在主窗口中
- 左侧一级导航为 `写作 / 报告 / 设置`
- `报告` 视图下提供 `本月 / 本年 / 自定义区间` 入口与报告列表
- 导出 PNG 可后续使用隐藏窗口或专用渲染容器完成

生成链路：

- 主进程负责扫描区间内实际存在的日记文件，缺失日期通过日期计算得出
- 有日记则纳入分析，无日记跳过正文处理
- 单篇日记优先复用已有 `summary + tags + mood`
- 若当天有日记且正文非空，但 `summary` 缺失，则可在报告生成时补做日级 AI 整理
- 该补做结果只写入当前报告 JSON，不回写原始 Markdown
- 报告生成默认不自动回写 Markdown，可增加缓存，但不改变“Markdown 是事实源”的原则
- 最终以事实层数据 + 日级摘要 + 少量代表性片段交给大模型生成区间总结文案
- 若区间总结 AI 失败，必须回退到本地可用摘要，不能让整份报告失败

数据落地：

- 月总结：`<workspace>/reports/monthly/YYYY-MM.json`
- 年总结：`<workspace>/reports/yearly/YYYY.json`
- 自定义区间：`<workspace>/reports/custom/<reportId>.json`

JSON 结构约定：

- 顶层至少包含：`version`、`reportId`、`preset`、`period`、`generation`、`summary`、`source`、`dailyEntries`、`sections`
- `summary.text` 始终存在，是最小可用结果
- `dailyEntries` 保存逐日事实快照，如日期、是否有日记、字数、心情、summary、tags、location、写作小时、摘要来源
- `sections` 为可选模块，适合前端直接渲染图表；未勾选则不生成该 section
- 推荐 section：`stats`、`heatmap`、`moodTrend`、`tagCloud`、`highlights`、`locationPatterns`、`timePatterns`

交互约定：

- 当前实现是在报告页内提供生成卡片与 section 勾选区，默认全选
- 用户可选择是否生成基础统计、字数热力图、情绪变化、标签词云、重点事件、地点分析、时间段分析
- 简要总结文本默认始终生成，不作为可取消项

JSON 示例：

```json
{
  "version": 1,
  "reportId": "report_2026-04-13T21-30-12_range_2026-03-01_2026-03-31",
  "preset": "month",
  "period": {
    "startDate": "2026-03-01",
    "endDate": "2026-03-31",
    "label": "2026 年 3 月总结",
    "generatedAt": "2026-04-13T21:30:12.000+08:00",
    "timezone": "Asia/Shanghai"
  },
  "generation": {
    "requestedSections": [
      "stats",
      "heatmap",
      "moodTrend",
      "tagCloud",
      "highlights",
      "locationPatterns",
      "timePatterns"
    ],
    "entryInsightPolicy": "reuse-or-generate",
    "reusedEntryInsightCount": 18,
    "generatedEntryInsightCount": 5,
    "skippedEmptyDays": 8,
    "warnings": []
  },
  "summary": {
    "text": "这个月整体写作节奏较稳定，主题集中在产品整理、功能推进和状态调整。",
    "themes": ["产品设计", "功能实现", "工作复盘"],
    "progress": ["明确了报告能力方向", "持续推进写作主流程"],
    "blockers": ["部分边界仍在讨论", "夜间写作偏多"],
    "memorableMoments": ["确定将月报、年报统一为区间总结"]
  },
  "source": {
    "totalDays": 31,
    "entryDays": 23,
    "missingDays": 8,
    "totalWords": 18426,
    "averageWords": 801,
    "longestStreak": 6
  },
  "dailyEntries": [
    {
      "date": "2026-03-01",
      "hasEntry": true,
      "wordCount": 623,
      "mood": 1,
      "summary": "重新梳理了写作工具定位。",
      "tags": ["产品设计", "项目规划"],
      "location": "家",
      "createdAt": "2026-03-01T22:14:12.000+08:00",
      "updatedAt": "2026-03-01T22:48:03.000+08:00",
      "writingHour": 22,
      "insightSource": "frontmatter"
    },
    {
      "date": "2026-03-02",
      "hasEntry": false,
      "wordCount": 0,
      "mood": null,
      "summary": "",
      "tags": [],
      "location": "",
      "createdAt": null,
      "updatedAt": null,
      "writingHour": null,
      "insightSource": "missing"
    }
  ],
  "sections": {
    "stats": {
      "recordDays": 23,
      "missingDays": 8,
      "totalWords": 18426,
      "averageWords": 801,
      "maxWordsInOneDay": 1688,
      "maxWordsDate": "2026-03-18",
      "longestStreak": 6,
      "currentStreakAtEnd": 3
    },
    "heatmap": {
      "points": [
        { "date": "2026-03-01", "value": 623 },
        { "date": "2026-03-02", "value": 0 }
      ]
    },
    "moodTrend": {
      "points": [
        { "date": "2026-03-01", "value": 1 },
        { "date": "2026-03-02", "value": null }
      ],
      "averageMood": 1.3
    },
    "tagCloud": {
      "items": [
        { "label": "产品设计", "value": 9 },
        { "label": "功能实现", "value": 8 }
      ]
    },
    "highlights": {
      "events": [
        {
          "date": "2026-03-03",
          "title": "区间总结方向基本确定",
          "summary": "统一月报、年报和自定义时间段总结，明确了功能边界。",
          "tags": ["报告系统", "架构设计"],
          "score": 0.92
        }
      ]
    },
    "locationPatterns": {
      "topLocation": {
        "name": "家",
        "count": 11
      },
      "uniqueLocation": {
        "name": "咖啡馆",
        "countInRange": 1,
        "score": 0.81,
        "reason": "仅出现一次，但对应记录篇幅较长且事件密度较高。"
      },
      "ranking": [
        { "name": "家", "count": 11 },
        { "name": "公司", "count": 8 }
      ]
    },
    "timePatterns": {
      "topTimeBucket": {
        "label": "晚上 18-24",
        "count": 12
      },
      "uniqueTimeBucket": {
        "label": "凌晨 0-5",
        "countInRange": 4,
        "score": 0.76,
        "reason": "出现次数不算最高，但多次对应长文和高强度思考记录。"
      },
      "buckets": [
        { "label": "凌晨 0-5", "count": 4 },
        { "label": "上午 9-12", "count": 3 },
        { "label": "晚上 18-24", "count": 12 }
      ]
    }
  }
}
```

字段解释：

- `version`：报告 JSON 结构版本号。
- `reportId`：报告唯一标识，用于落盘、缓存、列表展示。
- `preset`：生成预设，取值 `month`、`year`、`custom`。
- `period`：报告覆盖区间与生成时间信息。`label` 供前端直接展示，`timezone` 用于保证日期解释一致。
- `generation`：本次生成过程信息。`requestedSections` 是用户勾选项；`entryInsightPolicy` 表示日级摘要优先复用、缺失再生成；`warnings` 用于记录不影响生成的异常或缺失。
- `summary`：整份区间报告的核心摘要。`text` 必须存在；其余字段用于补充主题、进展、阻塞和值得记住的时刻。
- `source`：区间基础统计，主要用于顶部概览卡。
- `dailyEntries`：逐日事实快照。即使前端暂时不全部展示，也建议保存，便于后续扩展新图表。
- `dailyEntries[].hasEntry`：当天是否存在日记。
- `dailyEntries[].wordCount`：当天字数，没写时为 `0`。
- `dailyEntries[].mood`：当天心情，未知时为 `null`。
- `dailyEntries[].summary`、`tags`、`location`：当天用于聚合分析的核心信息。
- `dailyEntries[].writingHour`：从 `createdAt` 或 `updatedAt` 提取的写作小时，用于时间段统计。
- `dailyEntries[].insightSource`：摘要来源，`frontmatter` 表示原文已有，`generated` 表示本次补做，`missing` 表示当天没有日记。
- `sections`：可选分析模块集合；未勾选则该字段下不出现对应 section。
- `sections.stats`：基础统计明细，如单日最高字数、最长连续记录等。
- `sections.heatmap.points`：字数热力图数据，前端直接按日期和值渲染。
- `sections.moodTrend.points`：情绪折线图数据，空值可断线或跳过。
- `sections.tagCloud.items`：词云或标签频次图数据，`value` 为权重或出现次数。
- `sections.highlights.events`：重点事件列表，`score` 用于排序和筛选。
- `sections.locationPatterns.topLocation`：最常写作地点。
- `sections.locationPatterns.uniqueLocation`：最独特地点，建议附带 `score` 与 `reason`，避免只有结论没有解释。
- `sections.locationPatterns.ranking`：地点频次排行，可用于柱状图。
- `sections.timePatterns.topTimeBucket`：最常写作时间段。
- `sections.timePatterns.uniqueTimeBucket`：最独特时间段，同样建议附带原因。
- `sections.timePatterns.buckets`：时间段分布数据，前端可直接画柱状图。
- 推荐约定：`summary` 始终存在；勾选但无数据的 section 允许保留空数组或 `null`，未勾选则不生成对应字段。

## 9. UI 方向

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

## 10. 一句话原则

这是一个本地优先、写作优先、主流程稳定优先的桌面日记工具；所有实现都应服务于这个目标。
