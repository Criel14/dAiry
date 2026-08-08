# dAiry 报告链路优化设计（2026-08-08）

## 背景与目标

用户反馈生成区间报告时 AI 调用频繁超时：区间总结两次调用开启 thinking 但仅 60s 超时且无重试；日级补做 31 天串行执行，最坏耗时数小时。同时存在年报上下文截断（AI 只能看到区间前 20 天）、画像无消费方、若干小问题。

目标：修复超时、控制成本、提升年报总结质量、补做结果回填 frontmatter 形成跨报告复用。

## 范围（用户确认 A/B/C/D，去掉展示/导出去重）

- A. 多轮对话式总结（替换现有"focus 选日 + 最终总结"两阶段）
- B. 日级补做并行化 + 结果回填 frontmatter
- C. 报告 prompt 注入用户画像
- D. 整体体检（死代码、schema 校验、宽度常量、导出失败提前通知）

## A. 多轮对话式总结

现状问题：
- `report-ai-service.ts` 中 focus 与总结两次调用均 `thinking: true`，超时仅 `max(timeoutMs, 60s)`，且无重试（一次失败整体回退 fallback 文案），与日级的 `withAiRetry` 降级策略不对称。
- 最终总结 prompt 的 `compactTimeline` 取区间前 20 天，365 天年报只看到 1 月 + 5 个焦点日，存在事实盲区。

设计：
- 新建 `electron/main/ai/range-report-chat.ts`：会话层，主进程内维护单次报告的 messages 数组；`sendWithRetry(messages, {thinking})` 包 `withAiRetry`，递增超时 60s→120s→180s；thinking 轮超时下限 180s。
- 重构 `generateRangeReportSummaryWithAi` 为两轮会话：
  - 轮 1（无 thinking）：全量 digest（所有天的紧凑摘要，含 supplement + 画像）→ AI 返回 3-6 个焦点日；失败回退启发式**均匀分桶**选日（覆盖全年不同阶段）。
  - 轮 2（thinking，超时下限 180s）：messages 累积轮 1 往返 + 焦点日全文（≤2200 字 × 最多 8 天）→ 输出 `{text, progress, blockers, memorableMoments}` JSON；失败回退本地 fallback 文案 + warning。
- 删除 `buildSummaryPrompt`、`compactTimeline`（前 20 天截断）、`buildHeuristicFocusSelection` 改为均匀分桶。
- 轮次可扩展：未来加轮 3 只需追加一轮，不改会话骨架。

成本核算：年报全量 digest ≈ 30-50K 输入 token；两轮累积重发 ≈ 60-100K token/份，可控。

## B. 日级补做：并行 + 回填 frontmatter

现状问题：
- `hydrateMissingDailyInsights` 对缺 summary 的天**串行**调用 `ensureDailyInsights`，每篇又各自重读最近 N 天摘要（N×M 次读盘）。
- 补做结果只进报告 JSON，下次报告重付 AI 费，且 MCP 检索/日总结上下文永远看不到补做成果。

设计：
- 串行 for → 并发池（并发 5）；近 N 天摘要先批量读一次，通过函数参数传入共用。
- 补做成功后回填：
  - `writeJournalDocument(filePath, {...frontmatter, summary, tags, mood, updatedAt: now}, body)`
  - `updateJournalMetaEntry(workspacePath, date, frontmatter, body)` 同步元索引
- 回填失败只记 warning，报告照常生成；不触发画像/时间轴异步维护（报告链路保持轻量）。
- 跨报告复用自然达成：下次同一篇 summary 非空即复用，不再重付 AI 费。
- 同步更新 AGENTS.md："补做只进报告 JSON 不回写 Markdown" → "补做成功后回填 frontmatter 并同步元索引"。

## C. 画像接入

- 报告轮 1/轮 2 prompt 追加当年 `user-profile-YYYY.md`（主进程内读取，复用 `memory/retrieval.ts` 的 `getUserProfile`，不违反"画像不经过 IPC"约束）。
- 画像优先级低于区间事实（与 supplement 一致）。

## D. 整体体检

1. `report/storage.ts` `readReportWithFallback` 死代码：ENOENT 时抛可读中文"报告不存在"。
2. 报告读取温和 schema 校验：reportId/period/summary.text 缺失 → 中文报错而非前端 TypeError。
3. 导出宽度下限统一为 1000（主进程 `report-export/utils.ts` 与渲染端对齐）。
4. 新增 `report-export:notify-error` IPC 通道 + preload API + 导出页失败时调用，主进程立即失败返回中文错误，不再干等 20s 超时。

## 验证

- `npm run build`（typecheck + 打包）通过。
- 手动验证：配置 AI 生成月报/年报——观察两轮调用与重试日志、回填后 frontmatter/元索引、无 AI 配置时 fallback 正常、报告照常落盘。
