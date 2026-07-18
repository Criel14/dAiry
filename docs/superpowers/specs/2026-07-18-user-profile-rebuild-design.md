# 用户画像全量重建 — 设计文档

> **状态：** 已确认
> **日期：** 2026-07-18
> **关联：** 2026-07-18-daily-summary-context-and-user-profile-design.md（L1/L2 已实现）

---

## 1. 概述

L2 画像系统的冷启动只覆盖最近一个刷新周期（默认 7 天），老用户的存量历史日记永远不会进入画像。本功能在设置页提供"重新整理用户画像"按钮：扫描当前工作区全部日记，**按月正序**逐轮投喂 AI，演进式重建一份覆盖完整历史的画像。

已确认的关键决策：

| 决策点 | 结论 |
|--------|------|
| 中途失败/取消/关闭应用 | **全成功才写盘**——磁盘旧画像在完成前一字不动 |
| UI 反馈 | 实时逐月进度 + 可取消 |
| 处理顺序 | 按月时间正序（画像随时间演进） |
| 与自动整理的并发 | 重建期间 `runProfileMaintenance` 直接跳过 |
| Prompt | 新写重建专用 prompt，不复用全量刷新 prompt |

### 非目标

- 不做断点续跑（失败/取消后重新发起即从头开始）
- 不暴露画像内容给渲染进程（透明原则不变，只暴露操作与进度）
- 不新增用户配置项（config.json 无变化）
- 不中断在飞的 HTTP 请求（取消在轮间生效）

---

## 2. 交互流程

```
设置页"大模型"分区（画像整理间隔下拉之后）
  │
  ├─ [重新整理用户画像] 按钮
  │    禁用条件：AI 未配置 / 无工作区 / 正在重建
  │
  ▼ 点击
window.confirm 二级确认：
  "将扫描当前工作区的全部日记，按月重新构建用户画像（每个有日记的
   月份消耗一轮 AI 调用，token 消耗较大）。整理完成前现有画像保持
   不变，是否继续？"
  │
  ▼ 确认
按钮区显示进度："正在整理 2024-03（3/27）" + [取消] 按钮
  │        （期间可正常写日记、自动整理；仅画像维护被跳过）
  │
  ├─ 全部成功 → "画像整理完成（共 27 个月）。"
  ├─ 中途失败 → "整理失败于 2024-05：<中文原因>。现有画像未受影响。"
  └─ 用户取消 → 按钮先变"正在取消…" → "已取消，现有画像未受影响。"
```

---

## 3. 架构与数据流

```
渲染进程                                主进程
SettingsAiSection.vue                   electron/main/profile/
  ├─ 重建按钮/进度/取消 UI                ├─ profile-rebuild.ts   (新增)
  │   emit → app-shell composable        │    ├─ rebuildUserProfile(input)
  │                                      │    ├─ cancelUserProfileRebuild()
  ▼                                      │    ├─ 模块内取消标志 + 运行标志
window.dairy.rebuildUserProfile ────────▶│    └─ 进度经 webContents.send 推送
window.dairy.cancelUserProfileRebuild ──▶│
window.dairy.onUserProfileRebuildProgress◀─ IPC 事件（month, index, total）
                                         │
                                         ├─ profile-service.ts   (小改)
                                         │    ├─ runProfileMaintenance 开头
                                         │    │   检查"重建运行中"则跳过
                                         │    └─ 导出复用：writeUserProfile、
                                         │        剥代码围栏逻辑
                                         └─ ai/prompts/profile-rebuild.system.md (新增)
```

### 重建主循环

```
rebuildUserProfile({ workspacePath })
  1. 校验：AI 已配置（未配置抛中文错误）；已在重建中则拒绝
  2. 置运行标志（供 runProfileMaintenance 互斥）
  3. 扫描 journal/YYYY/MM/ 目录，收集含日记的月份列表，按月正序
     （文件名匹配 YYYY-MM-DD.md；空月不计入）
     月份列表为空 → 抛"当前工作区没有可用于整理的日记。"
  4. profile = ''（内存变量，不读、不清空磁盘文件）
  5. for 每个月份 month（index 从 1 到 total）：
       a. 轮间检查取消标志 → 已取消则返回 { status: 'cancelled', ... }
       b. 推送进度事件 { month, index, total }
       c. 读该月全部日记（按日期排序，正文按预算截断）
       d. AI 调用：system = profile-rebuild prompt，
          user = 截至上月的画像 + 本月日记列表
       e. 剥代码围栏、校验非空 → 更新内存 profile
  6. 全部成功：
       writeUserProfile(workspacePath, profile)
       updateWorkspaceConfig({ lastProfileRefresh: now })   ← 防止下次
         自动整理立即触发周期刷新覆盖重建结果
       返回 { status: 'completed', processedMonths, totalMonths }
  7. finally：清除运行标志
```

### 取消语义

- `cancelUserProfileRebuild()` 仅置取消标志，立即返回；无重建运行时调用为 no-op
- 主循环在**轮间**检查标志；正在飞的那轮 AI 调用不被中断，返回后结果丢弃
- 因此取消到真正结束最长等待一轮调用（约 `timeoutMs`，30s）
- 取消不视为错误：`rebuildUserProfile` 的 Promise resolve `{ status: 'cancelled' }`

---

## 4. IPC 与 Preload

新增 3 个 preload API（`src/types/api.ts` 同步扩展）：

```typescript
rebuildUserProfile: (input: RebuildUserProfileInput) => Promise<RebuildUserProfileResult>
cancelUserProfileRebuild: () => Promise<void>
onUserProfileRebuildProgress: (
  listener: (progress: UserProfileRebuildProgress) => void,
) => () => void   // 返回取消订阅函数，仿 onWindowZoomFactorChanged
```

新增类型（`src/types/ai.ts`）：

```typescript
interface RebuildUserProfileInput {
  workspacePath: string
}

interface RebuildUserProfileResult {
  status: 'completed' | 'cancelled'
  processedMonths: number
  totalMonths: number
}

interface UserProfileRebuildProgress {
  month: string      // 'YYYY-MM'
  index: number      // 当前第几个月（1 起）
  total: number      // 总月数
}
```

IPC channels（`src/shared/ipc-channels.ts`）：

- `profile:rebuild-user-profile`（invoke）
- `profile:cancel-user-profile-rebuild`（invoke）
- `profile:user-profile-rebuild-progress`（主进程 → 渲染，事件）

失败路径：`rebuildUserProfile` reject 中文错误消息（渲染层 catch 后展示）；扫描不到任何日记月份时也以中文错误拒绝（"当前工作区没有可用于整理的日记。"）。

**边界坚持**：画像内容不经过任何 IPC 通道；渲染进程只能看到进度与结果状态。

---

## 5. Prompt 设计

### 为什么不复用 `profile-full-refresh.system.md`

全量刷新 prompt 的语义是"旧画像仅作参考，允许大幅重写"。逐月迭代几十轮后，这种语义会让早期月份的信息被逐步冲刷。重建需要相反的语义：**演进式累积**。

### 新增 `electron/main/ai/prompts/profile-rebuild.system.md`

核心指令：

- 你在参与一次按时间顺序的画像重建：输入是"截至上月的画像"与"本月日记"，输出融合后的新画像
- **累积原则**：既有画像中的信息默认保留；本月日记提供新信息则补充，与旧信息冲突则以更新的为准
- 只精简明显过时、被后续事实取代的内容，不因"本月未提及"而删除长期信息
- 画像框架与日更/刷新 prompt 一致（身份与角色 / 日常习惯与作息 / 进行中的项目与关注话题 / 情绪模式 / 其他观察）
- 事实与安全约束、输出约束（首行 `# 用户画像`、无解释、无代码块包裹）与既有两个画像 prompt 一致
- 全文 1500 字以内

User prompt 结构（每轮）：

```
整理月份：${YYYY-MM}（第 ${index}/${total} 个月）

截至上月的用户画像：
${profile || '（这是第一个月，画像从空开始）'}

本月日记：
---
日期: ${date}
心情: ${mood}
摘要: ${summary || '（无）'}
正文:
${body}
---
...
```

**温度**：0.3；**response_format**：无（纯文本），复用 `completeText`。

---

## 6. Token 预算

| 项 | 策略 |
|----|------|
| 单篇正文 | 截断上限 = `min(2200, floor(60000 / 当月篇数))` 字符 |
| 单月总量 | 上述公式保证正文总量 ≤ 60K 字符 |
| 画像自身 | prompt 约束 1500 字，随轮次稳定 |

31 篇满月场景：每篇约 1935 字符，总量约 60K 字符 + 画像 + 指令 ≈ 65K token 内，128K 上下文模型安全；32K 模型可能吃紧，失败时错误消息会明确指向该月份，用户可知晓。

---

## 7. 并发与互斥

| 场景 | 行为 |
|------|------|
| 重建中点"自动整理" | 日总结正常执行；`runProfileMaintenance` 开头检查重建标志，直接 return（跳过日更与周期刷新） |
| 重建中再点重建按钮 | UI 层按钮禁用；主进程二次防护——运行中直接 reject |
| 重建中关闭应用 | 进程结束任务自然中止；因未写盘，旧画像无损；下次启动无残留状态 |
| 循环依赖防护 | 运行标志与共享工具放 `profile-service.ts`，`profile-rebuild.ts` 单向依赖 service，service 不 import rebuild |

---

## 8. 前端 UI

`SettingsAiSection.vue` 大模型配置卡片内、两个画像下拉之后新增一块：

- 静止态：说明文字（"扫描全部历史日记按月重建画像，适合老用户首次启用画像或画像质量退化时使用"）+ [重新整理用户画像] 按钮
- 运行态：进度文本"正在整理 2024-03（3/27）" + [取消] 按钮
- 结果消息复用现有 `setting-feedback` 样式
- 状态与回调经 app-shell composable 管理（新增 `handleRebuildUserProfile` / `handleCancelUserProfileRebuild`，进度状态存 shell state），组件保持无副作用
- 进度事件订阅在 composable 中建立，组件卸载/应用退出时取消订阅

---

## 9. 风险与边界

| 风险 | 缓解 |
|------|------|
| 长任务期间用户等待焦虑 | 逐月进度实时可见；可取消 |
| 几十轮调用 token 成本高 | 二级确认明确告知；取消随时止损 |
| 单月内容超模型上下文 | 60K 字符预算 + 按篇均摊截断；失败错误指明月份 |
| 早期信息被后续轮次冲刷 | 重建专用 prompt 强调累积语义（区别于全量刷新的重写语义） |
| 重建结果被周期刷新立即覆盖 | 完成时同步更新 `lastProfileRefresh` |
| AI 中途返回劣质/空内容 | 空内容即失败中止（旧画像无损）；质量问题可重跑 |

---

## 10. 其他

- git 提交 message 格式沿用"英文前缀 + 中文内容"
- 本功能完成后，AGENTS.md 的 AI 约束需补充：画像重建入口存在、重建期间自动画像维护跳过、preload 新增 3 个画像操作 API（内容仍不暴露）
