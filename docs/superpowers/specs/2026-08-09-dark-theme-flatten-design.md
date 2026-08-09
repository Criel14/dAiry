# 深色主题扁平化优化设计文档

日期：2026-08-09
状态：已与用户确认

## 1. 目标

优化现有深色主题（dark），延续纯白主题确立的视觉语言：极简、扁平化、层次靠边框而非阴影。

- 去除卡片类阴影，弹窗/浮层保留（减弱）阴影
- 报告页重玻璃渐变改近纯色，去掉高光描边
- 修复深色下图表网格线不可见问题
- 背景保持近黑（#050608），色板（背景/表面/文本/边框/金色点缀）不动
- 只改 `src/shared/theme/tokens/dark.css`，light/pure 零影响

## 2. 改动清单（仅 dark.css 的装饰性 token）

### 2.1 卡片阴影 → 透明

| Token | 现值 | 新值 |
|---|---|---|
| `--shadow-soft` | `0 10px 22px rgba(0,0,0,0.28)` | 透明 |
| `--shadow-medium` | `0 16px 34px rgba(0,0,0,0.36)` | 透明 |
| `--shadow-soft-sm` | `0 8px 18px rgba(0,0,0,0.24)` | 透明 |
| `--shadow-soft-xs` | `0 6px 14px rgba(0,0,0,0.2)` | 透明 |
| `--shadow-slider-thumb` | `0 2px 8px rgba(0,0,0,0.28)` | 透明 |
| `--shadow-slider-thumb-hover` | `0 4px 12px rgba(0,0,0,0.34)` | 透明 |
| `--shadow-tag-cloud` | `inset 高光 + 0 10px 24px 0.18` | 透明 |
| `--shadow-report-hero` | `inset 高光 + 0 20px 42px 0.24` | 透明 |
| `--shadow-report-card-soft` | `0 10px 22px rgba(0,0,0,0.18)` | 透明 |
| `--shadow-report-card-soft-strong` | `0 12px 26px rgba(0,0,0,0.24)` | 透明 |
| `--shadow-report-hover` | `0 12px 26px rgba(0,0,0,0.22)` | 透明 |
| `--shadow-report-cta` | `0 12px 24px rgba(0,0,0,0.24)` | 透明 |
| `--shadow-chart-point` | `0 2px 8px rgba(0,0,0,0.26)` | 透明 |

透明写法统一：`0 0 0 rgba(0, 0, 0, 0)`（与 pure.css 一致）

### 2.2 弹窗阴影 → 减弱保留

| Token | 现值 | 新值 |
|---|---|---|
| `--shadow-popover` | `0 14px 32px rgba(0,0,0,0.34)` | `0 10px 24px rgba(0,0,0,0.22)` |
| `--shadow-modal` | `0 24px 56px rgba(0,0,0,0.42)` | `0 16px 36px rgba(0,0,0,0.28)` |
| `--shadow-report-modal` | `0 24px 56px rgba(0,0,0,0.42)` | `0 16px 36px rgba(0,0,0,0.28)` |
| `--shadow-chart-tooltip` | `0 16px 34px rgba(0,0,0,0.32)` | `0 10px 24px rgba(0,0,0,0.24)` |

### 2.3 报告渐变 → 近纯色

| Token | 现值 | 新值 |
|---|---|---|
| `--gradient-report-hero` | radial 高光 + 线性渐变 | `linear-gradient(180deg, #141920, #0d1014)` |
| `--gradient-report-summary` | glass 卡片渐变 | `linear-gradient(180deg, #141920, #10151b)` |
| `--gradient-report-card` | white-95 玻璃 + 强渐变 | `linear-gradient(180deg, #141920, #10151b)` |
| `--gradient-report-card-hover` | 高亮渐变 | `linear-gradient(180deg, #1a2029, #141a21)` |
| `--gradient-report-action` | 深金渐变 | `linear-gradient(180deg, #322812, #241d0e)` 保留（已是深金系） |
| `--gradient-report-side-panel` | 深蓝灰渐变 | `linear-gradient(180deg, #0f1319, #0a0d12)` 保留 |

（action / side-panel 已是低调渐变，仅确认保留；主要改 hero / summary / card / card-hover）

### 2.4 图表网格线 → 深色下可见

| Token | 现值 | 新值 |
|---|---|---|
| `--color-glass-shadow-42` | `rgba(0,0,0,0.42)` | `rgba(255,255,255,0.06)` |
| `--color-glass-shadow-62` | `rgba(0,0,0,0.62)` | `rgba(255,255,255,0.09)` |

（这两个 token 被 MoodTrendChart 用作网格线 stroke；黑色网格线在近黑背景上不可见）

## 3. 边界

- 不动：foundation 色板（背景/表面/文本/边框/强调）、surfaces/content 各 token、`dark-icons.css`、`TimelineCard.css` / `TimelineView.css` 的 dark 分支、`report-export.css`
- `glass-white-*` 装饰性高光描边 token 保留（引用方已随 2.1 移除引用）
- light / pure 主题零影响

## 4. 验证

- `cmd /c "npm run typecheck"`（CSS 不校验，仅确认无 TS 回归）
- `cmd /c "npx vite build"`（CSS 语法与构建）
- 手动：深色主题下各页面卡片无阴影、报告页无高光渐变、弹窗有轻阴影、图表网格线可见；切回 light/pure 无变化
