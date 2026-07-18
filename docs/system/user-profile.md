# dAiry 用户画像文档

## 概览

用户画像是从日记内容中持续提炼的个人特征档案，以 Markdown 文件存储在工作区元数据目录下。画像维护全程由主进程执行，对前端透明（不暴露查看入口），失败只记日志不影响日记写作主流程。

```
自动整理成功 → 日更 + 全量刷新检查 → user-profile.md
设置页按钮   → 按月迭代重建       → user-profile.md
```

---

## 一、数据存储

| 文件 | 路径 | 说明 |
|------|------|------|
| 画像内容 | `<workspace>/.dairy/user-profile.md` | Markdown 格式，AI 直接写入 |
| 刷新时间戳 | `<workspace>/.dairy/workspace.json` | `lastProfileRefresh` 字段 |

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

## 二、三种更新场景

### 2.1 增量日更（自动）

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
4. AI 返回 Markdown → 剥除代码围栏 → 写回 `user-profile.md`

**约束：**
- 非阻塞，放 void 上下文执行
- 画像读取失败（文件不存在）视为空画像，首次从零开始
- AI 失败只打 `console.warn` 日志，绝不阻断

### 2.2 全量刷新（自动）

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

### 2.3 手动重建（用户触发）

设置页 → "重新整理用户画像"按钮：

```
preload: rebuildUserProfile({ workspacePath })
  → ipc/profile.ts
    → profile-rebuild.ts: rebuildUserProfile()
```

**流程：**

1. 扫描 `journal/YYYY/MM/` 目录树，收集所有月份
2. 逐月正序迭代（从最早月份开始）：

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

三个 prompt 文件均在 `electron/main/ai/prompts/`：

| 模板 | 用途 | 更新策略 |
|------|------|---------|
| `profile-daily-update.system.md` | 增量日更 | 只修改与当天相关的小节 |
| `profile-full-refresh.system.md` | 周期性全量刷新 | 综合区间日记全面重写 |
| `profile-rebuild.system.md` | 手动按月重建 | 累积式迭代：保留长期信息，新信息补充/覆盖 |

---

## 四、关键函数位置

| 函数 | 文件 |
|------|------|
| `runProfileMaintenance` | `electron/main/profile/profile-service.ts:292` |
| `updateUserProfileDaily` | `electron/main/profile/profile-service.ts:187` |
| `refreshUserProfileFull` | `electron/main/profile/profile-service.ts:223` |
| `rebuildUserProfile` | `electron/main/profile/profile-rebuild.ts:159` |
| `cancelUserProfileRebuild` | `electron/main/profile/profile-rebuild.ts:34` |
| `normalizeProfileMarkdown` | `electron/main/profile/profile-service.ts:60` |
| `createProfileAiClient` | `electron/main/profile/profile-service.ts:174` |

---

## 五、架构约束

- **画像内容不过 IPC**，渲染进程不持有画像数据
- AI 失败不影响日记保存，日更/全量刷新失败只打 warn 日志
- 手动重建全成功才写盘，失败不会覆盖现有画像
- 重建期间自动维护直接跳过（`isProfileRebuildRunning` 互斥锁）
- `normalizeProfileMarkdown` 剥除 AI 可能包裹的代码围栏后写入
- 画像写入使用 `writeFile` 全量覆盖，不做 diff/merge
