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
- `src/app/`：应用壳层与页面级组合逻辑
- `src/components/journal/`：日记主流程
- `src/components/settings/`：设置页
- `src/components/form/`：表单复用组件
- `src/components/report/`：报告与导出相关 UI
- `src/components/workspace/`：工作区侧栏
- `src/shared/`：跨业务共享工具与主题逻辑
- `src/shared/theme/`：主题 token、全局基础样式与主题入口
- `src/types/`：共享类型
- `electron/main/`：主进程模块
- `electron/preload.ts`：安全桥接

前端目录约定：

- 继续保持按业务域组织目录，不要把所有组件重新摊平成一个大平层
- 业务域内部优先按职责拆分，如 `components/`、`sections/`、`panel/`、`composables/`、`config/`、`shared/`
- `.vue` 与其专属 `.css` 优先同目录放置，避免跨目录散落
- 仅在确实跨业务复用时再放入 `src/shared/` 或通用表单目录，避免“看起来通用、实际只被一个页面使用”的过早抽象
- `src/style.css` 仅作为全局样式入口使用，不再堆积主题 token 或大段基础样式
- 主题相关资源集中维护在 `src/shared/theme/`：
  - `tokens.css`：主题 token，包含颜色、阴影、渐变、图表色板等可替换设计值
  - `base.css`：全局基础样式，如 `html/body/#app`、字体、box-sizing、导出模式基础布局
  - `index.css`：主题样式聚合入口

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
- 渲染进程通过 IPC / `preload` 向主进程传参时，只传可结构化克隆的普通数据；不要直接传 Vue 的响应式对象、`ref`、`computed`、`Proxy` 或其它不可序列化对象，必要时先转成普通对象或普通数组

修改联动时注意：

- 改 Electron 入口或 preload 时，同步检查 `vite.config.ts`
- 改打包行为时，同步检查 `electron-builder.json5`
- 改 preload API 时，同步更新调用侧与共享类型
- 改主题切换逻辑时，同步检查 `src/shared/theme.ts`、`src/shared/theme/tokens.css`、`src/shared/theme/base.css`
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
        "count": 1
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
        "count": 4
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
- `sections.locationPatterns.uniqueLocation`：相对特别的地点，保留地点名与出现次数即可。
- `sections.locationPatterns.ranking`：地点频次排行，可用于柱状图。
- `sections.timePatterns.topTimeBucket`：最常写作时间段。
- `sections.timePatterns.uniqueTimeBucket`：相对特别的时间段，保留时间段与出现次数即可。
- `sections.timePatterns.buckets`：时间段分布数据，前端可直接画柱状图。
- 推荐约定：`summary` 始终存在；勾选但无数据的 section 允许保留空数组或 `null`，未勾选则不生成对应字段。

### 8.1 报告 PNG 导出方案

定位：

- PNG 导出属于报告的展示层增强，不改变报告生成链路的事实来源和 JSON 结构定位。
- 导出能力服务于“分享 / 留档 / 打印前查看”，不是新的事实源，也不是新的报告格式。
- 导出失败不能影响已有报告读取，更不能影响日记保存。

核心原则：

- “生成报告”和“导出图片”是两个阶段，不要耦合成一次操作。
- 生成阶段的 section 勾选，决定报告 JSON 中是否真的计算和落盘该 section。
- 导出阶段的内容勾选，决定当前导出图片里是否展示该 section，不要求重新生成报告。
- 同一份已存在报告，应允许多次导出成不同内容组合的 PNG。

交互目标：

- 用户在报告页打开一份已生成的报告后，可以点击 `导出 PNG`。
- 导出前弹出导出设置面板，而不是直接截当前页面。
- 导出设置至少包含“导出内容”复选框，用户可取消如“地点分析”“时间段分析”等模块。
- 导出设置可后续扩展图片尺寸、浅色主题、是否显示生成时间、是否显示 warnings 等选项，但 V1 不必一次做全。

导出内容勾选建议：

- `cover`：标题区，包含报告标题、区间、副标题。
- `stats`：基础统计。
- `summary`：区间概览。
- `warnings`：生成提示。
- `heatmap`：字数热力图。
- `moodTrend`：情绪变化。
- `tagCloud`：标签词云。
- `locationPatterns`：地点分析。
- `timePatterns`：时间段分析。

约束：

- `cover`、`stats`、`summary` 建议默认勾选。
- 若某 section 在当前报告中本就不存在，则导出面板中对应选项应禁用或隐藏，而不是允许勾选后导出空块。
- 导出时的勾选结果只影响本次图片输出，不回写报告 JSON。

为什么不直接截图当前报告页：

- 当前报告页是交互态页面，包含滚动容器、横向热力图滚动区和响应式布局，不适合作为稳定导出面。
- 直接截当前页面容易只截到可视区域，或把滚动条、hover、选中状态一起带进图片。
- 长区间报告高度不稳定，直接截图当前容器在尺寸、内存和清晰度上都不够可控。

推荐实现：专用导出渲染面 + 主进程截图

- 不直接对用户当前看到的 `ReportsPanel` 做截图。
- 新增“导出文档模式”或“导出专用组件”，以静态长图排版方式渲染报告。
- 主进程创建隐藏 `BrowserWindow`，加载专用导出页面。
- 渲染完成后由主进程使用 `capturePage()` 获取位图并写入 PNG。
- 文件保存、路径选择、异常处理全部留在主进程，渲染进程只负责传入报告数据和导出选项。

不推荐作为首选的方案：

- 不优先采用 `html2canvas` 一类浏览器侧截图库作为主方案。
- 原因是 Electron 已有原生窗口截图能力，额外引入前端截图库会增加兼容性、字体渲染和滚动区域处理成本。
- 若后续某些局部图表需要单独位图化，可再局部评估，不作为总导出链路基础。

推荐链路：

1. 用户在报告页点击 `导出 PNG`。
2. 渲染进程弹出导出设置面板，收集当前报告 `reportId` 与导出选项。
3. 通过 `preload` 调用显式 IPC，如 `report:export-png`。
4. 主进程读取报告 JSON，构建导出 payload。
5. 主进程创建隐藏导出窗口，加载专用导出路由或导出页面。
6. 导出页面根据传入的报告数据和导出选项进行静态渲染。
7. 渲染完成后通知主进程进入截图。
8. 主进程截图并弹出保存对话框，写入 PNG。
9. 返回导出结果给前端，显示“导出成功”或可读错误文案。

导出页面形态：

- 导出页面应与应用内报告页视觉语言一致，但布局上更接近“文档”而不是“工作台”。
- 固定导出宽度，建议 V1 使用单一宽度，如 `1200px` 或相近值，避免响应式结果影响图片稳定性。
- 去除交互态元素：滚动条、悬浮态、按钮、切换器、hover 效果、历史列表等。
- 所有 section 在导出模式中应顺序纵向排布，不依赖用户滚动可见区域。
- 热力图、词云、趋势图在导出模式下使用稳定尺寸，避免基于容器实时测量后出现波动。

组件组织建议：

- 保留现有 `ReportsPanel.vue` 作为应用内阅读视图。
- 新增一个专用导出视图，例如：
  - `src/components/report/ReportExportDocument.vue`
  - 或 `src/components/report/export/` 目录存放导出相关组件。
- 应用内视图和导出视图可复用一部分纯展示子组件，但不要强行把所有逻辑揉进一个大组件。
- 如果某个 section 在导出和应用内显示差异较大，允许做双实现，不必为了“复用率”牺牲稳定性。

渲染与截图边界：

- 导出窗口只负责把“某份报告的某次导出内容”渲染成静态页面。
- 导出窗口不承担工作区选择、报告生成、列表切换等业务状态。
- 导出窗口输入应是纯数据对象，而不是依赖当前主窗口里的响应式状态。
- 导出完成后窗口应立即销毁，不长期保留隐藏窗口实例。

文件保存策略：

- 导出时应弹出保存对话框，让用户明确选择导出位置。
- 默认文件名可使用 `报告标题 + 导出日期` 组合。
- 月报示例：`2026年3月总结.png`
- 年报示例：`2026年总结-01.png`
- 自定义区间示例：`2026-03-01至2026-03-31总结.png`
- 不要求默认把 PNG 强制写入工作区 `reports/` 下；报告 JSON 是工作区派生数据，PNG 更接近用户导出产物。
- 若后续要支持“快速导出到工作区”，可作为增强项，而不是 V1 默认行为。

单张长图与多图分页：

- 月报和较短自定义区间，可优先支持单张长图导出。
- 年报和跨度较长的自定义区间，不应强制只有一张超长 PNG。
- V1 就应允许主进程根据导出内容高度，生成多张 PNG。
- 生成多张时，文件名自动追加序号，如 `-01`、`-02`、`-03`。

分页原则：

- 不按像素硬切内容块中间，优先以 section 为分页单位。
- 单个 section 尽量完整保留在同一张图内。
- 若某个 section 自身过高，再考虑 section 内局部分页，但应保证标题和内容对应关系清楚。
- `cover + stats + summary` 建议尽量出现在第一页，形成可独立分享的封面图。

导出模式下的 section 规则：

- `cover`：始终放最前，包含标题、区间、预设类型。
- `stats`：建议保持概览卡样式，但布局更规整，优先用于首页展示。
- `summary`：保留 AI/本地生成的总述和结构化条目。
- `warnings`：若勾选且有内容，则展示；为空时不占位。
- `heatmap`：导出模式下不使用横向滚动，应整体展开显示。
- `moodTrend`：导出尺寸固定，文字和折线需保证高分辨率下清晰。
- `tagCloud`：若当前词云实现依赖容器尺寸随机排布，导出模式应改为稳定布局，避免每次导出不同。
- `locationPatterns`、`timePatterns`：保持简洁统计卡 + 排名列表形式即可，优先信息稳定。

数据与类型建议：

- 报告 JSON 结构继续保持以“事实和分析结果”为核心，不直接混入导出专用显示状态。
- 导出功能新增单独类型，而不是改造 `RangeReport` 本体去承载临时导出 UI 状态。
- 可新增：
  - `ReportExportSectionKey`
  - `ReportExportOptions`
  - `ExportRangeReportInput`
  - `ExportRangeReportResult`
- 若导出 section 与报告 section 不完全同构，允许它们是两套 key。
- 例如 `cover`、`summary`、`warnings` 是导出视图模块，不一定等于 `ReportSectionKey`。

建议的导出输入语义：

- `workspacePath`
- `reportId`
- `sections`
- `imageScale`
- `filePath` 或 `saveMode`

建议的导出结果语义：

- `canceled`
- `filePaths`
- `exportedSections`
- `imageCount`

IPC 与 preload 约束：

- 导出能力必须经由 `preload` 暴露显式 API，不让渲染进程直接调用 Electron 原生对象。
- IPC 命名保持报告域收敛，例如：
  - `report:export-png`
  - `report:choose-export-path`（如果后续需要拆分）
- 修改 `preload` 后，必须同步更新共享类型声明和调用侧。

主进程实现约束：

- 主进程负责读取报告、校验导出参数、创建隐藏窗口、保存文件、清理临时资源。
- 主进程应限制导出窗口权限，继续保持最小暴露面，不把完整 Node 能力开放给导出页面。
- 导出失败时返回可读错误，例如“当前报告不存在”“图片保存失败”“导出内容为空”。
- 多次重试仍失败时，应停止导出并反馈原因，不做无限重试。

导出窗口建议：

- 使用隐藏 `BrowserWindow`，`show: false`。
- 使用独立尺寸，宽度与导出文档宽度一致，高度可先给较大初始值再按内容调整。
- 等待字体、图表和异步布局稳定后再截图。
- 导出页面渲染完成时主动通知主进程，不要只依赖固定延时。

导出完成信号建议：

- 可由导出页面在 `mounted` 后等待下一帧及必要资源加载，再通过 IPC 回传 `ready-to-capture`。
- 若图表有动画，导出模式应关闭动画，避免截图时机不稳定。
- 热力图等依赖 `ResizeObserver` 或容器测量的模块，在导出模式下应提供固定尺寸分支，减少等待链路。

性能与稳定性约束：

- 导出不应阻塞主窗口继续浏览已有内容。
- 但导出期间可显示“正在准备图片”的轻提示，避免用户误以为无响应。
- 超长区间导出时应限制单张最大高度，超过阈值自动分页。
- 对可能的空报告、缺 section、图表无数据等情况，导出页应优雅降级，不抛出前端异常。

UI 文案建议：

- 按钮文案：`导出 PNG`
- 面板标题：`导出图片`
- 复选框分组：`导出内容`
- 主按钮：`开始导出`
- 处理中：`正在准备图片...`
- 成功：`图片已导出`
- 失败：使用可读中文，不直接暴露技术栈报错原文

MVP 范围建议：

- 仅支持导出当前已打开的报告。
- 仅支持 PNG，不同时做 PDF、SVG。
- 提供 section 复选框。
- 使用固定浅色导出主题。
- 优先支持月报与普通自定义区间的单张或少量分页导出。
- 年报允许直接多张 PNG 输出，不要求先解决“单张超长图”。

MVP 不做：

- 不做导出模板市场或多套风格皮肤。
- 不做用户自由拖拽排序 section。
- 不做导出前复杂编辑器式排版。
- 不做把导出设置回写进报告 JSON。
- 不做云分享、链接分享、社交媒体适配裁切。

推荐实现顺序：

1. 明确导出类型、IPC 和 preload API。
2. 先做导出设置面板与 section 勾选。
3. 完成专用导出文档组件，能在主窗口内本地预览。
4. 接入隐藏窗口渲染与主进程截图。
5. 完成保存对话框与单张 PNG 导出。
6. 增加自动分页与多张导出。
7. 最后再打磨尺寸、文案、边距和空数据降级。

与现有报告能力的关系：

- 当前生成报告时的 section 勾选继续保留，用于控制生成成本和 JSON 内容。
- 新增导出时的 section 勾选，是展示层过滤，不替代原有生成勾选。
- 若用户在生成时未包含某个 section，则导出时不能凭空生成该 section。
- 若未来支持“缺失 section 后补生成”，那应被定义为重新生成报告，而不是导出逻辑的一部分。

一句话约束：

- 报告 PNG 导出本质上是“将现有区间报告按稳定文档布局渲染为图片”的能力，而不是“对当前屏幕做截图”。

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

主题与样式约束：

- 当前主题切换机制由 `src/shared/theme.ts` 统一负责，通过 `html[data-theme]` 与 `html[data-theme-preference]` 驱动
- 新增或修改视觉样式时，优先复用 `src/shared/theme/tokens.css` 中已有 token；不要在业务组件 CSS 中重新写十六进制颜色、`rgba(...)`、阴影或渐变
- 若现有 token 不足，优先补充 token，再在组件中引用；不要为了图省事把颜色直接写回组件
- token 命名优先使用语义化命名，如 `--color-text-main`、`--color-surface-muted`、`--shadow-soft`，避免使用纯值导向命名
- 仅当某个视觉值明确只服务于单一业务域时，才允许增加少量业务语义 token；但仍应放在 `tokens.css` 中集中管理
- `html[data-theme='dark']` 是深色主题唯一正式覆盖入口；后续深色主题落地时，优先通过覆盖 token 完成，而不是复制一套组件 CSS
- 报告图表、导出页、滚动条、悬浮态、选中态等也属于主题系统的一部分，新增这类视觉时同样要走 token
- 若导出视图需要固定浅色方案，应通过独立 token 或明确的导出模式约束实现，不要回退到分散硬编码
- `base.css` 只放全局基础规则，不承载业务组件样式
- 组件本地 CSS 应主要描述布局、间距、结构和状态关系；主题值交给 token 层统一管理

## 10. 一句话原则

这是一个本地优先、写作优先、主流程稳定优先的桌面日记工具；所有实现都应服务于这个目标。
