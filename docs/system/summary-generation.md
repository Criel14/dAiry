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
   - aiContext     (用户补充知识，可选)

3. 检查配置就绪 (baseURL + model + apiKey 都存在)

4. 构建 user prompt:
   - 业务日期
   - 工作区已有标签列表
   - [可选] AI 上下文补充知识
   - 当日日记正文

5. 调用 AI (OpenAI 兼容 API, temperature=0.2)
   要求返回: {"summary":"一句话总结","tags":["..."],"mood":0}

6. 解析 JSON → 标准化:
   - summary: 必须非空
   - tags:    去重、对齐工作区标签大小写、至少 3 个
   - mood:    -5~5 整数
```

### 结果去向

- 返回 `{ summary, tags, mood, existingTags, newTags }` 给前端
- 前端填入 frontmatter 表单草稿，**不自动保存**，需用户手动保存到 .md

### 在区间报告中的复用

区间报告生成时调用 `ensureDailyInsights()`：如果某天已有 summary + ≥3 tags 则直接复用，否则调用上述 AI 生成。**AI 生成的 insight 只写入报告 JSON，不回写原始 .md**。

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

对**有正文但无 summary** 的日期，调用 `ensureDailyInsights()` 用 AI 生成。成功则标注 `insightSource: 'generated'`，失败则保留原数据 + 追加 warning。已有 summary 的直接复用（`insightSource: 'frontmatter'`）。

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

#### 第 6 步：AI 生成区间总结（两阶段）

**阶段一：聚焦日期选择**

当区间内日记 > 7 天时，先用启发式评分（加权字数、心情绝对值、标签数、有无 summary）排序，再用 AI 从 compact digest 中挑 3~5 天最值得细看的日期。AI 失败时用启发式结果兜底。

**阶段二：生成总结**

构建 user prompt，包含：
- 区间统计事实（top 标签、热门地点、时段分布、平均心情）
- 前 20 天 compact digest（summary 截断到 84 字、前 4 个 tag）
- 聚焦日期的**完整正文**（截断到 2200 字）及其他详细信息

调用 AI 输出结构化总结：

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
| 区间 AI 总结 | 降级为统计模版 fallback |
| 聚焦 AI 选择 | 使用启发式评分结果 |
| API Key 缺失 | 抛出中文错误，不发起请求 |

核心原则：**任何 AI 失败都不阻塞报告生成和保存**，统计 section 始终是本地确定的。

---

## 四、架构约束

- **本地 Markdown 是唯一事实源**，报告 JSON 是派生物
- **AI 生成的日级内容不回写原始 .md**
- **生成报告和导出图片是两阶段操作**，不耦合
- 密钥只在主进程内存中出现，渲染进程只拿脱敏状态
