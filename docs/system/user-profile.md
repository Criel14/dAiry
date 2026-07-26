# dAiry 用户画像文档

## 概览

用户画像是从日记内容中持续提炼的个人特征档案，以 Markdown 文件存储在工作区元数据目录下。画像维护全程由主进程执行，对前端透明（不暴露查看入口），失败只记日志不影响日记写作主流程。

```
自动整理成功 → 画像解析 + 日更 + 全量刷新检查 → user-profile-YYYY.md
设置页按钮   → 智能缺口重建               → user-profile-YYYY.md
新年首次日更 → 复制上年画像为种子           → user-profile-YYYY.md
存量迁移     → user-profile.md → user-profile-YYYY.md
```

---

## 一、数据存储

| 文件 | 路径 | 说明 |
|------|------|------|
| 画像内容 | `<workspace>/.dairy/user-profile/user-profile-YYYY.md` | 按年份分版本，AI 直接写入 |
| 刷新时间戳 | `<workspace>/.dairy/workspace.json` | `lastProfileRefresh` 字段 |

- 当前年份画像为活跃文件，日更和全量刷新只操作当前年份文件
- 过往年份画像自动归档，不再修改
- 存量 `<workspace>/.dairy/user-profile.md` 会在首次日更时自动迁移到 `user-profile/` 目录并删除
- 若 `user-profile/` 目录为空且无旧版文件，画像维护静默跳过

画像 Markdown 约定结构：

```markdown
# 用户画像
## 身份与角色
## 日常习惯与作息
## 进行中的项目与关注话题
## 情绪模式
## 其他观察
```

---

## 二、四种更新场景

### 2.1 画像解析（自动）

每次自动整理成功后 `runProfileMaintenance` 首先执行 `resolveProfileForYear`：

```
提取日期年份 → 查找 user-profile-YYYY.md
  → 存在 → 直接返回路径
  → 不存在 → 向前逐年查找（YYYY-1, YYYY-2, ...）
    → 找到 → 复制为 user-profile-YYYY.md（种子画像），返回路径
    → 找不到 → 检查旧版 user-profile.md
      → 存在 → 复制到 user-profile/user-profile-YYYY.md，删除旧版
      → 不存在 → 返回 null，静默跳过本次维护
```

### 2.2 增量日更（自动）

每次用户点击"自动整理"成功后异步触发：

```
journal.ts: generateDailyInsights 返回后
  → void runProfileMaintenance({ workspacePath, date, body })
    → updateUserProfileDaily()
```

**流程：**

1. 读取当前画像 + 最近 N 天日记摘要（`dailyContextDays` 配置）
2. 加载 `profile-daily-update.system.md` prompt
3. AI 调用（temperature=0.3，无 json mode），只更新与当天日记相关的小节
4. AI 返回 Markdown → 剥除代码围栏 → 写回 `user-profile-YYYY.md`

**约束：**
- 非阻塞，放 void 上下文执行
- 画像读取失败（文件不存在）视为空画像，首次从零开始
- AI 失败只打 `console.warn` 日志，绝不阻断
- 年份从 `input.date` 提取，始终操作当年画像文件

### 2.3 全量刷新（自动）

日更完成后，根据 `profileRefreshIntervalDays`（默认 7 天）判断是否触发：

```
shouldRunFullRefresh(workspacePath, date, intervalDays)
  → 距上次 lastProfileRefresh ≥ intervalDays 天
    → refreshUserProfileFull()
```

**流程：**

1. 计算区间 `[today - intervalDays + 1, today]`
2. 收集区间内所有日记正文（每篇截断 2200 字）
3. 加载 `profile-full-refresh.system.md` prompt
4. AI 用完整区间日记 + 现有画像重写全量画像
5. 成功则写盘 + 更新 `lastProfileRefresh`

**约束：**
- 同样非阻塞，失败只记日志
- 全量刷新期间如果用户手动触发重建，自动维护直接跳过（`isProfileRebuildRunning` 互斥）

### 2.4 手动重建（用户触发）

设置页 → "重新整理用户画像"按钮：

```
preload: rebuildUserProfile({ workspacePath })
  → ipc/profile.ts
    → profile-rebuild.ts: rebuildUserProfile()
```

**流程：**

1. 查找最新归档画像年份（当前年份之前），如 `user-profile-2025.md`
2. 以归档画像为种子，只扫描缺口年份（从归档年份次年 1 月起）
3. 若没有归档画像，从头扫描所有月份（与旧行为一致）
4. 逐月正序迭代：

```
Month 1: AI([system], [month1 日记])               → profile1
Month 2: AI([system], [profile1 + month2 日记])      → profile2
Month 3: AI([system], [profile2 + month3 日记])      → profile3
...
```

3. 每篇正文截断 2200 字，单月总预算 60K 字符
4. AI 调用 temperature=0.3，超时 120 秒，每轮最多重试 1 次
5. 全部成功 → 写盘 + 更新 `lastProfileRefresh`
6. 任一月份失败 → 整体抛错，之前处理月份的进展不保留

**进度推送：**

```
onProgress({ month, index, total })
  → getMainWindow().webContents.send('profile:user-profile-rebuild-progress')
    → 设置页显示"正在整理 YYYY-MM（index/total）"
```

**取消：**

```ts
cancelUserProfileRebuild()
  → 设置 isCancelRequested = true
    → 下一个月的循环开始前或全部完成后检查标志位
```

注意：当前 AI 调用进行中无法中止，需等当前调用完成。

---

## 三、Prompt 模板

三种场景共用相同的调用参数：`temperature = 0.3`、`completeText`（非 JSON mode），系统 prompt 分别使用以下三个文件：

| 模板文件 | 场景 | 更新策略 |
|----------|------|---------|
| `electron/main/ai/prompts/profile-daily-update.system.md` | 增量日更 | 只修改与当天相关的小节 |
| `electron/main/ai/prompts/profile-full-refresh.system.md` | 周期性全量刷新 | 综合区间日记全面重写 |
| `electron/main/ai/prompts/profile-rebuild.system.md` | 手动按月重建 | 累积式迭代：保留长期信息，新信息补充/覆盖 |

### 3.1 增量日更 — user prompt 拼装

函数：`buildDailyUpdatePrompt`（`profile-service.ts:93`）。

| 块 | 内容 | 来源 |
|----|------|------|
| 业务日期 | `YYYY-MM-DD` | 当天日期 |
| 前 N 天摘要 | `- {date}: 摘要: {summary} \| 心情: {mood} \| 标签: {tags}` | `getRecentDailySummaries()`，默认最近 7 天 frontmatter |
| 当前画像 | 完整 Markdown 画像（或 `（当前画像为空，请创建初始画像）`） | `<workspace>/.dairy/user-profile.md` |
| 当日正文 | 截断至 2200 字的日记 body | 编辑器内存中的当天内容 |

### 3.2 全量刷新 — user prompt 拼装

函数：`buildFullRefreshPrompt`（`profile-service.ts:107`）。

| 块 | 内容 | 来源 |
|----|------|------|
| 整理周期 | `{start} ~ {end}` | 最近 `profileRefreshIntervalDays` 天（默认 7） |
| 当前画像（参考） | 完整 Markdown（可能被大幅修改） | `<workspace>/.dairy/user-profile/user-profile-YYYY.md` |
| 区间日记 | 每篇一段：`日期 / 心情 / 摘要 / 正文（截断 2200 字）` | 区间内所有日记文件，当天优先用内存 `body` |

### 3.3 手动重建 — user prompt 拼装

函数：`buildRebuildPrompt`（`profile-rebuild.ts:135`），逐月迭代调用。

| 块 | 内容 | 来源 |
|----|------|------|
| 整理月份 | `YYYY-MM`（第 `i/n` 个月） | 目录树扫描结果 |
| 截至上月的画像 | 上一轮 AI 输出全文（首月为空） | 累积传递 |
| 本月日记 | 每篇：`日期 / 心情 / 摘要 / 正文（按预算截断）` | 当月所有日记文件 |

单篇截断上限：`min(2200, floor(60000 / 当月篇数))`，确保单月总预算 60K 字符。

### 3.4 AI 输出归一化

AI 返回 Markdown 后，`normalizeProfileMarkdown`（`profile-service.ts:60`）剥除可能的 ` ```markdown ` 代码围栏，再全量覆写 `user-profile-YYYY.md`。画像内部不使用 JSON，不做结构校验。

---

## 四、关键函数位置

| 函数 | 文件 |
|------|------|
| `runProfileMaintenance` | `electron/main/profile/profile-service.ts` |
| `resolveProfileForYear` | `electron/main/profile/profile-service.ts` |
| `updateUserProfileDaily` | `electron/main/profile/profile-service.ts` |
| `refreshUserProfileFull` | `electron/main/profile/profile-service.ts:223` |
| `rebuildUserProfile` | `electron/main/profile/profile-rebuild.ts:159` |
| `cancelUserProfileRebuild` | `electron/main/profile/profile-rebuild.ts:34` |
| `normalizeProfileMarkdown` | `electron/main/profile/profile-service.ts:60` |
| `createProfileAiClient` | `electron/main/profile/profile-service.ts:174` |

---

## 五、架构约束

- **画像内容不过 IPC**，渲染进程不持有画像数据
- 按年分版：`user-profile-YYYY.md`，当前年份为活跃文件，过往年份自动归档不修改
- 存量单文件 `user-profile.md` 首次日更时自动迁移
- `user-profile/` 目录为空且无旧版文件时，画像维护静默跳过
- 新年首次日更时自动复制上年画像作为种子
- AI 失败不影响日记保存，日更/全量刷新失败只打 warn 日志
- 手动重建全成功才写盘，失败不会覆盖现有画像；仅重建缺口年份，不影响已归档画像
- 重建期间自动维护直接跳过（`isProfileRebuildRunning` 互斥锁）
- `normalizeProfileMarkdown` 剥除 AI 可能包裹的代码围栏后写入
- 画像写入使用 `writeFile` 全量覆盖，不做 diff/merge
