# 时间轴批量整理设计：逐日判定单事件

日期：2026-09-01
状态：已确认

## 背景与目标

现状：时间轴侧栏「重新整理 X 年时间轴」按钮触发 `rebuildTimelineYear`，按 **3 天一批次**调用 AI，AI 自由产出事件（可能一天多个、跨天合并、dateEnd 时间段语义残留），且提示词允许"平凡日常中持续的事项也值得记录"，导致事件质量参差、与"仅记录值得纪念的大事件"的产品方向不一致。

目标：保持入口、进度、取消、前端零改动，改造 `rebuildTimelineYear` 行为为**批次调用、逐天判定、值得才生成单事件**：

- 7 天一批次（全年约 52 次调用）
- AI 对每天日记独立判定是否值得纪念（宁缺毋滥，与 `timelineWorthy` 标准一致）
- 值得的日期生成一条事件，一天最多一个，id 由主进程生成（`evt_{YYYYMMDD}_001`）
- 全量覆盖整年（同现状）：某天判定不值得则当天无事件，整年文件重写
- 取消、进度推送、全成功才落盘、无日记年份 skipped 等既有行为不变

## 一、提示词重写（`electron/main/ai/prompts/timeline-extract.system.md`）

- 删除：rule 2（平凡日常持续事项）、rule 5（dateEnd）、rule 7（updatedEvents）、输出示例中的 `dateEnd`/`updatedEvents` 字段
- 新增逐天判定规则：
  - 值得记录：公司大活动（年会、团建、发布会）、家人来访、个人娱乐活动（演唱会、旅行）、重大决定、里程碑事件、重要聚会等当天真正发生的较有意义的事
  - 不值得记录：普通日常、吃了什么、起床很晚、例行上班上学、碎片化心情记录等
  - 宁可保守：平淡的一天不产出事件
- 新输出格式：

```json
{"events":[{"date":"2026-03-15","title":"...","detail":"..."}]}
```

- 无值得记录的日期返回 `{"events":[]}`
- 事件必须基于日记原文；标题 4-12 字；详情 80-200 字；换行/引号转义约束保留

## 二、主进程改造（`electron/main/timeline/ai.ts` + `service.ts`）

### 2.1 批次大小

`buildBatches` 从 3 天一批改为 **7 天一批**（`cursor.add(6, 'day')`）。

### 2.2 返回结构

`ExtractResult` 从 `{ newEvents, updatedEvents }` 改为：

```ts
interface ExtractResult {
  events: Array<{ date: string; title: string; detail: string }>
}
```

`extractJsonObject` 的 4 层容错解析逻辑保留不变（仅泛型目标变化）。

### 2.3 汇总逻辑（新增纯函数 `normalizeBatchEvents`）

新增到 `electron/main/timeline/service.ts`（可单测）：

```ts
export function normalizeBatchEvents(
  raw: Array<{ date: string; title: string; detail: string }>,
): TimelineEvent[]
```

行为：

- 逐条生成 `id = evt_{YYYYMMDD}_001`（主进程生成，不由 AI 生成）
- `diaryDates = [date]`
- 按日期去重：同一天出现多条时取最后一条（一天最多一个）
- 返回事件数组

### 2.4 rebuildTimelineYear 调整

- 循环内删除 `existingEventsBlock`（不再回传已有事件，AI 无更新语义）
- 删除 `updatedEvents` 处理分支
- 每批 `result.events` 经 `normalizeBatchEvents` 归一化后并入 `allEvents`
- 落盘前仍走 `stripLegacyDateEnd`（防御旧格式残留）
- 进度、取消 token、`diaryBatchCount`、无日记批次跳过、日志均不变

## 三、测试

- `tests/timeline/service.test.ts` 新增 `normalizeBatchEvents` 用例：
  - id 生成格式 `evt_{YYYYMMDD}_001`
  - `diaryDates` 为 `[date]`
  - 同批重复日期取最后一条（去重）
  - 空输入返回空数组

## 四、前端

零改动。按钮文案、进度显示（`weekLabel`/`current`/`total`）、取消逻辑均不变。

## 五、文档同步

- `docs/system/timeline.md`：2.1 触发场景（3→7 天、逐日判定）、3.2 重建模式（user prompt 不含已有事件、批次说明）、3.3 返回格式（events 数组）、四、合并逻辑（normalizeBatchEvents 描述）、六、关键函数位置（新增 `normalizeBatchEvents`、`buildBatches` 说明更新）
- `AGENTS.md`：时间轴约束段补充批量整理逐日判定、一天最多一个
- `CHANGELOG.md`：Unreleased 补一条

## 六、验证

- `npm run test` 全部 PASS
- `npm run typecheck` 无错误
- 手动验证：
  1. 有日记年份 → 点击「重新整理 X 年时间轴」→ 进度按 7 天批次推进 → 完成 → 时间轴仅显示值得天的单事件
  2. 平淡日记年份 → 事件数为 0（全量覆盖）
  3. 整理期间取消 → 已处理事件不落盘

## 七、明确不做（本次范围外）

- 时间轴展示层样式改动
- MCP 新增批量工具
- 单日事件提取（`extractTimelineEventForDay`）行为调整
