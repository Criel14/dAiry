# 纯白主题（pure）设计文档

日期：2026-08-09
状态：已与用户确认（方案 A：独立 token 文件完整覆盖）

## 1. 目标

新增第三个主题「纯白」（`pure`）：

- 背景为纯白 `#ffffff`，替换现有浅色主题的米黄色系
- 风格：现代、扁平化、极简
- 强调色保留现有暖金色系作点缀（背景中性 + 金色点缀）
- 完全扁平：阴影全部移除，卡片靠边框区分层级
- 覆盖全部场景：主界面（写作/报告/记账/设置/时间轴）+ 报告导出页 + 报告 PNG 导出文档
- 主题只允许用户手动选择；`system` 仍按系统深浅解析为 light/dark，不受影响
- 不触碰现有 light/dark 的任何 token，保证既有主题零回归

## 2. 主题标识与切换链路

- `AppTheme` 扩展为 `'system' | 'light' | 'dark' | 'pure'`（`src/types/app.ts`）
- `apply.ts`：
  - `resolveThemePreference('pure')` 固定返回 `'pure'`，不跟随系统
  - `'system'` 仍解析为 light/dark，逻辑不变
  - `data-theme='pure'`、`data-themePreference='pure'` 生效
- `base.css`：新增 `html[data-theme='pure'] { color-scheme: light }`
- 主进程 `applyNativeThemeSource`：`'pure'` 映射为 `'light'`（`nativeTheme.themeSource` 仅支持 system/light/dark）
- `app-config.ts` `normalizeTheme` 白名单加 `'pure'`，非法值仍回退 `'system'`
- 设置页：`THEME_OPTIONS` 加「纯白」；`handleThemeChange` 白名单加 `'pure'`；保存成功文案适配
- 导出页无需改动：`useReportExportTheme` 复用 `applyThemePreference`，`report-export.css` 全部引用 `--color-*` token，自动继承纯白
- `BillsCharts` 已监听 `data-theme` 属性变化，图表自动跟随

## 3. token 视觉规格（`tokens/pure.css`，`html[data-theme='pure']` 选择器）

### 3.1 基础层（foundation）

| Token | 值 | 说明 |
|---|---|---|
| `--color-background` | `#ffffff` | 纯白 |
| `--color-surface` | `#ffffff` | 纯白 |
| `--color-surface-muted` | `#fafafa` | 浅灰 |
| `--color-surface-elevated` | `#ffffff` | 纯白 |
| `--color-text-main` | `#1f1f1f` | 近黑冷灰 |
| `--color-text-subtle` | `#757575` | 冷灰 |
| `--color-text-soft` | `#9e9e9e` | 浅冷灰 |
| `--color-border` | `#e6e6e6` | 中性灰 |
| `--color-border-soft` | `#f0f0f0` | 更浅灰 |
| `--color-border-strong` | `#d4d4d4` | 深灰 |
| `--color-accent-soft` | `#faf3e3` | 淡金底（点缀） |
| `--color-accent-muted` | `#f6ecda` | 淡金 |
| `--color-accent-strong` | `#b8914c` | 金色 |
| `--color-selection` | `rgba(184, 145, 76, 0.16)` | 金色选择 |
| `--shadow-soft` / `--shadow-medium` | 透明 | 完全扁平 |
| `--overlay-scrim` | `rgba(0, 0, 0, 0.24)` | 遮罩仍需半透明 |

### 3.2 surfaces 层

- 白/浅灰表面：sidebar `#ffffff`、chip `#f7f7f7`、interactive `#ffffff`、soft `#fafafa`、softest `#fcfcfc`、keycap `#f5f5f5`、status `#f2f2f2`、nav-active `#f6eed9`（淡金）、hover-soft `#f5f5f5`、code-inline `#f5f5f5`、table-head `#fafafa`、tag-cloud `#ffffff`、report-card `#ffffff`、report-note `#fafafa`、report-chip `#f0f0f0`、report-section-soft `#ffffff`、about-button `#f5f5f5`、switch-track `#dcdcdc`、slider-thumb `#ffffff`、control `#ffffff`、calendar-outside `#fafafa`
- 金色点缀保留：status-ready `#fbf3e2`、report-picker-active `#faf3e3`、report-picker-selected `#e6cf9c`
- 热力图（金色阶，深色字可读）：
  - report-heat-0 `#f7f7f7`、1 `#f3e8d2`、2 `#e9d3a8`、3 `#d8b877`、4 `#b8914c`
  - calendar-heat-1 `#f8f1df`、2 `#f3e7c4`、3 `#ead89f`、4 `#ddc170`

### 3.3 content 层

- 文本：text-accent `#8a6d2f`、text-warm `#9a7b3c`、text-warm-soft `#b08d4e`、text-strong-subtle `#3a3a3a`（中性化）、text-dirty `#b89133`、text-link `#8a6d2f`、text-weekend `#7a9aa8`、text-outside `rgba(0, 0, 0, 0.35)`、text-calendar-heat-3 `#5a4a26`、text-calendar-heat-4 `#47391f`、text-report-soft `#a08a5c`、text-report-soft-strong `#8f7847`、text-stepper `#a08040`、text-stepper-hover `#8a6a2f`、text-report-time `#a08855`
- 语义色保留（微调）：text-danger `#b4544c`、text-danger-soft `#a56059`、text-expense `#c05b52`、text-chart-neutral `#9a9a9a`（中性化）
- 边框：border-status-ready `#e8d9a8`、status-ready-soft `#e8d9b0`、calendar-today `#d9c07f`、selected-strong `#b8914c`、editor-error `#e8d9c8`、report 系列浅灰/浅金（软色系 `#e0e0e0`–`#e6e6e6`，强调项 `#d9c08a` 系）、slider 系列灰
- 图表：chart-positive `#4caf7d`、chart-positive-soft `#57b884`、chart-negative `#d96a6a`、chart-negative-soft `#e07373`、status-dot-running/stopped/error 对应语义
- 词云：tag-cloud-1~6 深金棕文本阶 `#6b5a3a` 系
- 时间轴：沿用浅色柔和彩色系（timeline-event-1~8 不变）

### 3.4 effects 层

- glass-white-*：白色透明系（`rgba(255,255,255,x)`）
- glass-ivory-*：白色透明
- glass-accent-*：金色 `rgba(184,145,76,x)`
- glass-border-*：中性灰透明
- glass-shadow-*：透明（扁平）
- glass-report-*：白色透明 + 淡金点缀
- 滚动条：`--scrollbar-thumb-color: #d9d9d9`、渐变灰阶
- `--gradient-mood-track`：浅灰 → 淡金 → 浅灰
- report 渐变：纯白系
- 所有 `--shadow-*`（soft-sm / xs / popover / slider / tag-cloud / report-hero / report-card / report-hover / report-cta / report-modal / modal / chart-point / chart-tooltip）：透明

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/shared/theme/tokens/pure.css` | 新增，完整 token 覆盖 |
| `src/shared/theme/tokens.css` | `@import './tokens/pure.css'` |
| `src/types/app.ts` | `AppTheme` 加 `'pure'` |
| `src/shared/theme/apply.ts` | `resolveThemePreference` 支持 `'pure'` |
| `src/shared/theme/base.css` | `html[data-theme='pure'] { color-scheme: light }` |
| `electron/main/window.ts` | `applyNativeThemeSource`：`'pure'` → `'light'` |
| `electron/main/app-config.ts` | `normalizeTheme` 白名单加 `'pure'` |
| `src/components/settings/config/config.ts` | `THEME_OPTIONS` 加「纯白」 |
| `src/components/settings/sections/SettingsAppearanceSection.vue` | 白名单加 `'pure'`，描述文案更新 |
| `src/app/composables/app-shell/preferences.ts` | 保存成功文案适配 |

不改：`tokens/foundation.css`、`surfaces.css`、`content.css`、`effects.css`、`dark.css`（light/dark 零回归）。

## 5. 验证

- `npm run typecheck`
- 手动验证：
  - 三主题来回切换，无样式残留
  - 系统深色下选择「纯白」仍固定为纯白（不跟随系统）
  - 深色系统下切回 `system` 恢复深色
  - 导出 PNG 文档为纯白风格
  - 回归：light/dark 视觉与改动前一致
