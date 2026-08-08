# dAiry 总结生成流程文档

## 概览

dAiry 有两类 AI 总结：**日总结（自动整理）** 和 **区间总结（报告生成）**。AI 请求只在主进程发起，AI 失败不影响核心功能。

```
渲染进程 → window.dairy.xxx() → preload 透传 IPC → 主进程 → AI API
```

---

## 一、日总结（自动整理）

### 触发入口

```
用户点击"自动整理" → window.dairy.generateDailyInsights(input)
→ ipc.ts:309 → generateDailyInsights()
→ ai/journal-ai-service.ts
```

### 处理流程

```
1. 校验输入 (日期有效、正文非空、工作区路径存在)

2. 并行加载:
   - appConfig     (AI 的 baseURL/model/timeout)
   - system prompt (daily-organize.system.md)
   - supplement   (用户补充知识，可选)

3. 检查配置就绪 (baseURL + model + apiKey 都存在)

4. 调用 AI (OpenAI 兼容 API, temperature=0.2, JSON mode)
   要求返回: {"summary":"一句话总结","tags":["..."],"mood":0}

5. 解析 JSON → 标准化:
   - summary: 必须非空
   - tags:    去重、对齐工作区标签大小写、至少 3 个
   - mood:    -5~5 整数
```

### AI Prompt 细节

系统 Prompt：`electron/main/ai/prompts/daily-organize.system.md`，核心指令：根据日记正文生成 summary（中文 20-40 字/英文 12-24 词，平实克制）、tags（3-8 个，优先复用工作区标签，禁止宽泛词如"生活""日记"）、mood（-5~5，有详细分值语义定义）。

**User prompt 由 4 块拼接（`buildDailyInsightsPrompt`，`journal-ai-service.ts:106`）：**

| 块 | 内容 | 来源 |
|----|------|------|
| 业务日期 | `YYYY-MM-DD` | 当天日期 |
| 工作区已有标签 | `当前工作区已有标签：tag1、tag2...` | `input.workspaceTags`，帮助 AI 优先复用 |
| 近期日记摘要（可选） | `- {date}: 摘要: {summary} \| 心情: {mood} \| 标签: {tags}` | `getRecentDailySummaries()`，最近 `dailyContextDays` 天 frontmatter，仅作上下文参考 |
| 补充知识（可选） | 用户撰写的长期背景/术语偏好 | `<workspace>/.dairy/supplement.md` |
| 当日日记正文 | Markdown body 全文（不截断） | `input.body`

### 结果去向

- 返回 `{ summary, tags, mood, existingTags, newTags }` 给前端
- 前端填入 frontmatter 表单草稿，**不自动保存**，需用户手动保存到 .md

### 在区间报告中的复用

区间报告生成时调用 `ensureDailyInsights()`：如果某天已有 summary + ≥3 tags 则直接复用，否则调用上述 AI 生成。**AI 生成的 insight 会回填该日记的 frontmatter（`summary`/`tags`/`mood`，`updatedAt` 刷新）并同步元索引**，回填失败只记 warning 不影响报告生成；下次报告直接复用 frontmatter，不再重复支付 AI 成本。补做**不触发**画像/时间轴维护。

### 注意

- **不关联历史日记**：只看当天正文 + 既有标签，不自动引用前几天的内容
- **不自动落盘**

---

## 二、区间总结（报告生成）

### 触发入口

```
用户选择月/年/自定义区间 → 点击"生成报告" → window.dairy.generateRangeReport(input)
→ ipc.ts:313 → generateRangeReport()
→ report/index.ts
```

### 完整流程（7 步）

#### 第 1 步：区间验证 (`report/range.ts`)

- 月报必须覆盖完整自然月、年报覆盖完整自然年、自定义跨度 ≤ 1 年
- 标准化 section 白名单（6 种：stats/heatmap/moodTrend/tagCloud/locationPatterns/timePatterns）

#### 第 2 步：构建日条目 (`report/daily-entries.ts`)

枚举区间内每一天 → 读取对应 .md 文件 → 提取：
- frontmatter（summary/tags/mood/location/createdAt/updatedAt）
- 统计字数、计算写作时段（writingHour）

文件不存在的日期标记为 `hasEntry: false`。

#### 第 3 步：补充缺失的日级 insight

对**有正文但无 summary** 的日期，调用 `ensureDailyInsights()` 用 AI 生成。**并发池（5 路）**执行，近 N 天摘要先批量读一次共用，避免逐篇重复读盘。成功则回填 frontmatter + 元索引并在报告中标注 `insightSource: 'generated'`，失败则保留原数据 + 追加 warning。已有 summary 的直接复用（`insightSource: 'frontmatter'`）。

#### 第 4 步：构建 6 个统计 section (`report/sections.ts`)

本地纯计算，不依赖 AI：

| Section | 内容 |
|---------|------|
| stats | 记录天数、总字数、平均/最大单日字数、最长连续记录、末尾连续记录 |
| heatmap | 每日字数热力点 `[{date, value}]` |
| moodTrend | 每日心情趋势 + 平均心情值 |
| tagCloud | 标签词频 Top 30 |
| locationPatterns | 最常用地点、最独特地点（稀有度×0.62 + 强度×0.38）、完整排名 |
| timePatterns | 6 个时段分桶（凌晨/早晨/上午/中午/下午/晚上），含最常用和最独特时段 |

#### 第 5 步：构建 fallback 总结 (`report/summary.ts`)

纯统计模版，例如：*"2026 年 7 月总结共记录 18 天，缺失 13 天，总字数 4280，最长连续记录 7 天。主要标签包括 工作、学习、运动。"*

#### 第 6 步：AI 生成区间总结（两轮对话）

主进程内维护单次报告的多轮会话（`ai/range-report-chat.ts`），每轮包 `withAiRetry` 递增超时重试（60s→120s→180s）；thinking 轮超时下限 180s。两轮 user prompt 均注入 supplement 与用户画像（`user-profile-YYYY.md`，优先级低于区间事实）。

**轮 1：素材消化与选日**（无 thinking；区间内日记 > 7 天时启用）

系统 Prompt：`electron/main/ai/prompts/range-report-summary-focus.system.md`，指令：从全量 digest 中选出 3~6 个最值得深入查看的日期并说明理由。

**User prompt 数据块：**

| 块 | 内容 | 来源 |
|----|------|------|
| 区间信息 | `period.start/end`, `source.preset/presetKey` | 请求参数 |
| 统计事实 | `topTags`、`locations`（排名）、`timeBuckets`、`moodAverage` | 第 4 步本地计算结果 |
| 每日候选（全量 digest） | 所有有正文日记的 `date/summary(截断84字)/tags(前4个)/mood/wordCount/location/insightSource` | 全部日条目，无前 N 天截断 |

AI 输出：`{"focusDates":[{"date":"...","reason":"..."}]}`。失败时回退**均匀分桶启发式**（按日期等分桶、桶内按加权评分选代表，保证覆盖区间各阶段）。选日往返会作为对话历史带入轮 2。

**轮 2：成文**（thinking，超时下限 180s）

系统 Prompt：`electron/main/ai/prompts/range-report-summary.system.md`，指令：综合区间事实和聚焦日记，输出结构化总结。

**User prompt 数据块：**

| 块 | 内容 | 来源 |
|----|------|------|
| 轮 1 往返（历史） | 轮 1 的全量 digest + AI 选日回复 | 会话 messages |
| 区间信息 | `period`、`source` | 请求参数 |
| 请求的 section | `generation.requestedSections`, `generation.warnings` | 第 1 步标准化结果 |
| 统计事实 | `topTags`、`locations`、`timeBuckets`、`moodAverage` | 第 4 步本地计算结果 |
| 聚焦日期 | 轮 1 选出的 `date/reason` + 对应的**完整正文**（截断 2200 字，最多 6 天） | 轮 1 输出 + 对应日记文件 body |
| contextDigest（兜底） | 全量 digest；仅当轮 1 未产生 AI 历史时附带 | 启发式路径 |

调用的 AI 输出结构化总结：

```ts
{
  text: "80-200 字区间概述",
  progress:          // 0~5 条阶段性推进
  blockers:          // 0~5 条阻塞或未解决
  memorableMoments:  // 0~5 条值得记住的瞬间
}
// 每项附带 timeAnchor: { type, label, startDate?, endDate?, dates? }
```

timeAnchor 支持 4 种类型：`day`（单日）、`range`（连续区间）、`multiple`（多个不连续日期）、`approx`（近似时间段）。

AI 失败时降级使用第 5 步的 fallback 统计模版。

#### 第 7 步：持久化 (`report/storage.ts`)

```text
<workspace>/reports/
  monthly/2026-07.json
  yearly/2026.json
  custom/custom_2026-07-01_2026-07-18_<timestamp>.json
```

---

## 三、失败兜底策略

| 环节 | 失败处理 |
|------|----------|
| 读取日记文件 (ENOENT) | 返回空条目，不阻断 |
| 日级 AI insight | 保留原始数据 + warning，继续 |
| 日级 insight 回填 frontmatter/元索引 | 只记 warning，不影响报告生成 |
| 区间 AI 总结 | 降级为统计模版 fallback |
| 轮 1 选日 AI | 使用均匀分桶启发式结果 |
| API Key 缺失 | 抛出中文错误，不发起请求 |

核心原则：**任何 AI 失败都不阻塞报告生成和保存**，统计 section 始终是本地确定的。

---

## 四、架构约束

- **本地 Markdown 是唯一事实源**，报告 JSON 是派生物
- **补做的日级 insight 成功后回填原始 .md 的 frontmatter 并同步元索引**（失败不阻塞报告）
- **生成报告和导出图片是两阶段操作**，不耦合
- 密钥只在主进程内存中出现，渲染进程只拿脱敏状态
