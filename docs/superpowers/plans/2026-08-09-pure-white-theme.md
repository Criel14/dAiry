# 纯白主题（pure）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增第三个主题「纯白」（pure）：纯白背景、中性灰阶、保留金色点缀、完全扁平（无阴影），覆盖主界面与报告导出，不影响现有 light/dark。

**Architecture:** `AppTheme` 扩展 `'pure'`；`resolveThemePreference('pure')` 固定返回 `'pure'`（不随系统）；新增 `tokens/pure.css` 以 `html[data-theme='pure']` 完整覆盖全部 token（对照 dark.css 覆盖面）；主进程 `nativeTheme` 将 `'pure'` 映射为 `'light'`；导出页复用同一链路自动继承。

**Tech Stack:** TypeScript / Vue 3 / CSS tokens（`src/shared/theme/tokens/`）/ Electron（nativeTheme）/ Vitest

**Spec:** `docs/superpowers/specs/2026-08-09-pure-white-theme-design.md`

---

### Task 1: 类型扩展与解析逻辑（TDD）

**Files:**
- Modify: `src/types/app.ts:4`
- Modify: `src/shared/theme/apply.ts:5-15`
- Create: `tests/theme/apply.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/theme/apply.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { resolveThemePreference } from '../../src/shared/theme/apply'

describe('resolveThemePreference', () => {
  it('returns pure theme directly', () => {
    expect(resolveThemePreference('pure')).toBe('pure')
  })

  it('returns explicit light and dark directly', () => {
    expect(resolveThemePreference('light')).toBe('light')
    expect(resolveThemePreference('dark')).toBe('dark')
  })

  it('falls back to light for system when no window API exists', () => {
    expect(resolveThemePreference('system')).toBe('light')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cmd /c "npx vitest run tests/theme/apply.test.ts"`
Expected: TS 报错 `resolveThemePreference('pure')` 类型不匹配 `'light' | 'dark'`

- [ ] **Step 3: 扩展类型**

`src/types/app.ts:4`：

```ts
export type AppTheme = 'system' | 'light' | 'dark' | 'pure'
```

- [ ] **Step 4: 实现解析逻辑**

`src/shared/theme/apply.ts`，修改 `resolveThemePreference`：

```ts
const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemePreference(theme: AppTheme): 'light' | 'dark' | 'pure' {
  if (theme === 'light' || theme === 'dark' || theme === 'pure') {
    return theme
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}
```

（其余函数不变；`applyThemePreference` 中 `data-theme` 自动接受新值 `'pure'`）

- [ ] **Step 5: 运行测试确认通过**

Run: `cmd /c "npx vitest run tests/theme/apply.test.ts"`
Expected: 3 个测试全部 PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/app.ts src/shared/theme/apply.ts tests/theme/apply.test.ts
git commit -m "feat(theme): 主题类型与解析逻辑支持纯白模式"
```

---

### Task 2: 主进程适配

**Files:**
- Modify: `electron/main/app-config.ts:57-61`
- Modify: `electron/main/window.ts:42-44`

- [ ] **Step 1: normalizeTheme 白名单加 pure**

`electron/main/app-config.ts` 的 `normalizeTheme`：

```ts
function normalizeTheme(rawValue: unknown): AppTheme {
  return rawValue === 'light' || rawValue === 'dark' || rawValue === 'pure' || rawValue === 'system'
    ? rawValue
    : 'system'
}
```

- [ ] **Step 2: nativeTheme 映射**

`electron/main/window.ts` 的 `applyNativeThemeSource`：

```ts
export function applyNativeThemeSource(theme: AppTheme) {
  nativeTheme.themeSource = theme === 'pure' ? 'light' : theme
}
```

（`nativeTheme.themeSource` 仅支持 `system | light | dark`，纯白是浅色系，窗口原生外观跟随 light）

- [ ] **Step 3: 类型检查**

Run: `cmd /c "npm run typecheck"`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add electron/main/app-config.ts electron/main/window.ts
git commit -m "feat(theme): 主进程支持纯白主题配置与原生外观映射"
```

---

### Task 3: CSS 接入（纯白入口）

**Files:**
- Modify: `src/shared/theme/tokens.css`
- Modify: `src/shared/theme/base.css:11-17`

- [ ] **Step 1: tokens 聚合引入 pure.css**

`src/shared/theme/tokens.css`：

```css
@import './tokens/foundation.css';
@import './tokens/surfaces.css';
@import './tokens/content.css';
@import './tokens/effects.css';
@import './tokens/dark.css';
@import './tokens/pure.css';
```

- [ ] **Step 2: color-scheme**

`src/shared/theme/base.css` 在 `html[data-theme='dark']` 规则后追加：

```css
html[data-theme='pure'] {
  color-scheme: light;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/theme/tokens.css src/shared/theme/base.css
git commit -m "feat(theme): 接入纯白主题 CSS 入口"
```

---

### Task 4: 纯白 token 完整覆盖

**Files:**
- Create: `src/shared/theme/tokens/pure.css`

- [ ] **Step 1: 创建 pure.css（完整内容）**

创建 `src/shared/theme/tokens/pure.css`，选择器 `html[data-theme='pure']`，覆盖如下全部 token：

```css
html[data-theme='pure'] {
  --color-background: #ffffff;
  --color-surface: #ffffff;
  --color-surface-muted: #fafafa;
  --color-surface-elevated: #ffffff;
  --color-text-main: #1f1f1f;
  --color-text-subtle: #757575;
  --color-text-soft: #9e9e9e;
  --color-border: #e6e6e6;
  --color-border-soft: #f0f0f0;
  --color-border-strong: #d4d4d4;
  --color-accent-soft: #faf3e3;
  --color-accent-muted: #f6ecda;
  --color-accent-strong: #b8914c;
  --color-selection: rgba(184, 145, 76, 0.16);
  --shadow-soft: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-medium: 0 0 0 rgba(0, 0, 0, 0);
  --overlay-scrim: rgba(0, 0, 0, 0.24);

  --color-surface-sidebar: #ffffff;
  --color-surface-chip: #f7f7f7;
  --color-surface-interactive: #ffffff;
  --color-surface-soft: #fafafa;
  --color-surface-softest: #fcfcfc;
  --color-surface-keycap: #f5f5f5;
  --color-surface-status: #f2f2f2;
  --color-surface-status-ready: #fbf3e2;
  --color-surface-nav-active: #f6eed9;
  --color-surface-hover-soft: #f5f5f5;
  --color-surface-code-inline: #f5f5f5;
  --color-surface-table-head: #fafafa;
  --color-surface-tag-cloud: #ffffff;
  --color-surface-report-card: #ffffff;
  --color-surface-report-note: #fafafa;
  --color-surface-report-chip: #f0f0f0;
  --color-surface-report-heat-0: #f7f7f7;
  --color-surface-report-heat-1: #f3e8d2;
  --color-surface-report-heat-2: #e9d3a8;
  --color-surface-report-heat-3: #d8b877;
  --color-surface-report-heat-4: #b8914c;
  --color-surface-report-picker-active: #faf3e3;
  --color-surface-report-picker-muted: #fafafa;
  --color-surface-report-picker-selected: #e6cf9c;
  --color-surface-report-section-soft: #ffffff;
  --color-surface-about-button: #f5f5f5;
  --color-surface-switch-track: #dcdcdc;
  --color-surface-slider-thumb: #ffffff;
  --color-surface-control: #ffffff;
  --color-surface-calendar-outside: #fafafa;
  --color-surface-calendar-heat-1: #f8f1df;
  --color-surface-calendar-heat-2: #f3e7c4;
  --color-surface-calendar-heat-3: #ead89f;
  --color-surface-calendar-heat-4: #ddc170;

  --color-text-accent: #8a6d2f;
  --color-text-warm: #9a7b3c;
  --color-text-warm-soft: #b08d4e;
  --color-text-strong-subtle: #3a3a3a;
  --color-text-dirty: #b89133;
  --color-text-link: #8a6d2f;
  --color-text-weekend: #7a9aa8;
  --color-text-outside: rgba(0, 0, 0, 0.35);
  --color-text-calendar-heat-3: #5a4a26;
  --color-text-calendar-heat-4: #47391f;
  --color-text-report-soft: #a08a5c;
  --color-text-report-soft-strong: #8f7847;
  --color-text-danger: #b4544c;
  --color-text-danger-soft: #a56059;
  --color-text-expense: #c05b52;
  --color-text-chart-neutral: #9a9a9a;
  --color-text-stepper: #a08040;
  --color-text-stepper-hover: #8a6a2f;
  --color-text-report-time: #a08855;

  --color-border-status-ready: #e8d9a8;
  --color-border-status-ready-soft: #e8d9b0;
  --color-border-calendar-today: #d9c07f;
  --color-border-selected-strong: #b8914c;
  --color-border-editor-error: #e8d9c8;
  --color-border-report-soft: #e4e4e4;
  --color-border-report-soft-strong: #dcdcdc;
  --color-border-report-hover: #d0d0d0;
  --color-border-report-section-warm: #e8e0cf;
  --color-border-report-picker: #d8c08a;
  --color-border-report-pill: #dcdcdc;
  --color-border-report-pill-active: #c9a85e;
  --color-border-report-pill-soft: #e6e6e6;
  --color-border-report-pill-strong: #d4d4d4;
  --color-border-slider-track: #e0e0e0;
  --color-border-slider-thumb: #cccccc;
  --color-border-slider-thumb-hover: #b3b3b3;
  --color-border-calendar-heat-1: #f0e6cd;
  --color-border-calendar-heat-2: #e9d8ab;
  --color-border-calendar-heat-3: #ddbf7f;
  --color-border-calendar-heat-4: #c99e4d;

  --color-chart-positive: #4caf7d;
  --color-chart-positive-soft: #57b884;
  --color-chart-negative: #d96a6a;
  --color-chart-negative-soft: #e07373;
  --color-status-dot-running: #4caf7d;
  --color-status-dot-stopped: #9a9a9a;
  --color-status-dot-error: #d96a6a;
  --color-tag-cloud-1: #6b5a3a;
  --color-tag-cloud-2: #7a6643;
  --color-tag-cloud-3: #8a724c;
  --color-tag-cloud-4: #9a7e55;
  --color-tag-cloud-5: #aa8a5e;
  --color-tag-cloud-6: #7a6947;

  --color-timeline-event-1: #A8C5D6;
  --color-timeline-event-2: #B8D0A8;
  --color-timeline-event-3: #D6C5A8;
  --color-timeline-event-4: #D6A8C1;
  --color-timeline-event-5: #A8D4D6;
  --color-timeline-event-6: #C5A8D6;
  --color-timeline-event-7: #D6D0A8;
  --color-timeline-event-8: #A8B5D6;

  --color-glass-white-58: rgba(255, 255, 255, 0.58);
  --color-glass-white-72: rgba(255, 255, 255, 0.72);
  --color-glass-white-74: rgba(255, 255, 255, 0.74);
  --color-glass-white-82: rgba(255, 255, 255, 0.82);
  --color-glass-white-86: rgba(255, 255, 255, 0.86);
  --color-glass-white-88: rgba(255, 255, 255, 0.88);
  --color-glass-white-90: rgba(255, 255, 255, 0.9);
  --color-glass-white-92: rgba(255, 255, 255, 0.92);
  --color-glass-white-95: rgba(255, 255, 255, 0.95);
  --color-glass-ivory-72: rgba(255, 255, 255, 0.72);
  --color-glass-ivory-75: rgba(255, 255, 255, 0.75);
  --color-glass-ivory-96: rgba(255, 255, 255, 0.96);
  --color-glass-accent-18: rgba(184, 145, 76, 0.18);
  --color-glass-accent-28: rgba(184, 145, 76, 0.28);
  --color-glass-accent-38: rgba(184, 145, 76, 0.38);
  --color-glass-accent-45: rgba(184, 145, 76, 0.45);
  --color-glass-accent-50: rgba(184, 145, 76, 0.5);
  --color-glass-accent-55: rgba(184, 145, 76, 0.55);
  --color-glass-accent-68: rgba(184, 145, 76, 0.68);
  --color-glass-accent-72: rgba(184, 145, 76, 0.72);
  --color-glass-accent-75: rgba(184, 145, 76, 0.75);
  --color-glass-accent-78: rgba(184, 145, 76, 0.78);
  --color-glass-accent-80: rgba(184, 145, 76, 0.8);
  --color-glass-accent-82: rgba(184, 145, 76, 0.82);
  --color-glass-accent-88: rgba(184, 145, 76, 0.88);
  --color-glass-accent-90: rgba(184, 145, 76, 0.9);
  --color-glass-accent-92: rgba(184, 145, 76, 0.92);
  --color-glass-accent-95: rgba(184, 145, 76, 0.95);
  --color-glass-border-85: rgba(0, 0, 0, 0.1);
  --color-glass-border-88: rgba(0, 0, 0, 0.11);
  --color-glass-border-90: rgba(0, 0, 0, 0.12);
  --color-glass-border-92: rgba(0, 0, 0, 0.13);
  --color-glass-border-95: rgba(0, 0, 0, 0.14);
  --color-glass-shadow-10: rgba(0, 0, 0, 0);
  --color-glass-shadow-14: rgba(0, 0, 0, 0);
  --color-glass-shadow-20: rgba(0, 0, 0, 0);
  --color-glass-shadow-42: rgba(0, 0, 0, 0);
  --color-glass-shadow-62: rgba(0, 0, 0, 0);
  --color-glass-shadow-90: rgba(0, 0, 0, 0);
  --color-glass-shadow-95: rgba(0, 0, 0, 0);
  --color-glass-accent-shadow-12: rgba(184, 145, 76, 0.12);
  --color-glass-selection-15: rgba(184, 145, 76, 0.15);
  --color-glass-text-warm-35: rgba(154, 123, 60, 0.35);
  --color-glass-text-accent-60: rgba(138, 109, 47, 0.6);
  --color-glass-white-stroke-70: rgba(255, 255, 255, 0.7);
  --color-glass-white-stroke-72: rgba(255, 255, 255, 0.72);
  --color-glass-white-stroke-96: rgba(255, 255, 255, 0.96);
  --color-glass-tag-cloud-stroke: rgba(255, 255, 255, 0.96);
  --color-glass-report-fill: rgba(255, 255, 255, 0.42);
  --color-glass-report-warning-fill: rgba(255, 251, 243, 0.92);
  --color-glass-report-fill-strong: rgba(255, 255, 255, 0.92);
  --color-glass-report-fill-soft: rgba(255, 255, 255, 0.96);
  --color-glass-report-gradient-start: rgba(255, 255, 255, 0.97);
  --color-glass-report-gradient-end: rgba(250, 250, 250, 0.94);
  --color-glass-report-gradient-card-start: rgba(255, 255, 255, 0.92);
  --color-glass-report-gradient-card-end: rgba(250, 250, 250, 0.82);
  --color-glass-report-gradient-card-strong-end: rgba(255, 255, 255, 0.86);
  --color-glass-report-gradient-card-hover-start: rgba(255, 255, 255, 0.98);
  --color-glass-report-gradient-card-hover-end: rgba(245, 245, 245, 0.78);
  --color-glass-report-grid: rgba(184, 145, 76, 0.2);
  --color-glass-axis-zero: rgba(0, 0, 0, 0.18);
  --color-glass-chart-positive: rgba(76, 175, 125, 0.72);
  --color-glass-chart-negative: rgba(217, 106, 106, 0.72);
  --color-glass-chart-positive-area-18: rgba(76, 175, 125, 0.18);
  --color-glass-chart-positive-area-08: rgba(76, 175, 125, 0.08);
  --color-glass-chart-positive-area-02: rgba(76, 175, 125, 0.02);
  --color-glass-chart-negative-area-02: rgba(217, 106, 106, 0.02);
  --color-glass-chart-negative-area-08: rgba(217, 106, 106, 0.08);
  --color-glass-chart-negative-area-18: rgba(217, 106, 106, 0.18);

  --scrollbar-thumb-color: #d9d9d9;
  --gradient-scrollbar-thumb: linear-gradient(180deg, #dcdcdc 0%, #cccccc 100%);
  --gradient-scrollbar-thumb-hover: linear-gradient(180deg, #d0d0d0 0%, #bdbdbd 100%);
  --gradient-mood-track: linear-gradient(90deg, #f0f0f0 0%, #f3e5c6 52%, #f0f0f0 100%);
  --gradient-report-hero:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), transparent 52%),
    linear-gradient(
      180deg,
      var(--color-glass-report-gradient-start),
      var(--color-glass-report-gradient-end)
    );
  --gradient-report-divider: linear-gradient(
    90deg,
    var(--color-glass-accent-92),
    rgba(184, 145, 76, 0.12)
  );
  --gradient-report-summary: linear-gradient(
    180deg,
    var(--color-glass-report-gradient-card-start),
    var(--color-glass-report-gradient-card-end)
  );
  --gradient-report-card: linear-gradient(
    180deg,
    var(--color-glass-white-95),
    var(--color-glass-report-gradient-card-strong-end)
  );
  --gradient-report-card-hover: linear-gradient(
    180deg,
    var(--color-glass-report-gradient-card-hover-start),
    var(--color-glass-report-gradient-card-hover-end)
  );
  --gradient-report-action: linear-gradient(180deg, #ffffff, #f7f1e2);
  --gradient-report-side-panel: linear-gradient(180deg, #ffffff, #fafafa);

  --shadow-soft-sm: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-soft-xs: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-popover: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-slider-thumb: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-slider-thumb-hover: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-tag-cloud: inset 0 1px 0 var(--color-glass-white-stroke-70);
  --shadow-report-hero: inset 0 1px 0 var(--color-glass-white-stroke-72);
  --shadow-report-card-soft: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-card-soft-strong: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-hover: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-cta: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-modal: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-modal: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-chart-point: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-chart-tooltip: 0 0 0 rgba(0, 0, 0, 0);
}
```

- [ ] **Step 2: 类型检查**

Run: `cmd /c "npm run typecheck"`
Expected: 无错误（CSS 不影响 TS，仅确认无语法级问题）

- [ ] **Step 3: Commit**

```bash
git add src/shared/theme/tokens/pure.css
git commit -m "feat(theme): 新增纯白主题完整 token 覆盖"
```

---

### Task 5: 设置页 UI 与文案

**Files:**
- Modify: `src/components/settings/config/config.ts:130-134`
- Modify: `src/components/settings/sections/SettingsAppearanceSection.vue:31-35,54-56`
- Modify: `src/app/composables/app-shell/preferences.ts:68-71`

- [ ] **Step 1: THEME_OPTIONS 加「纯白」**

`src/components/settings/config/config.ts` 的 `THEME_OPTIONS`：

```ts
export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'pure', label: '纯白' },
]
```

- [ ] **Step 2: 白名单与描述文案**

`src/components/settings/sections/SettingsAppearanceSection.vue`：

`handleThemeChange` 改为：

```ts
function handleThemeChange(value: string) {
  if (value === 'system' || value === 'light' || value === 'dark' || value === 'pure') {
    emit('update:theme', value)
  }
}
```

描述文案改为：

```html
<p class="panel-description">
  支持跟随系统、浅色、纯白和深色模式；纯白主题为固定浅色，不跟随系统变化。
</p>
```

- [ ] **Step 3: 保存消息文案**

`src/app/composables/app-shell/preferences.ts` 的 `handleUpdateTheme` 消息分支改为：

```ts
      state.themeSaveMessage.value =
        nextValue === 'system'
          ? '主题模式已切换为跟随系统，当前先保留现有视觉。'
          : nextValue === 'pure'
            ? '主题模式已切换为纯白。'
            : `主题模式已切换为${nextValue === 'light' ? '浅色' : '深色'}，样式方案会后续补齐。`
```

- [ ] **Step 4: 类型检查**

Run: `cmd /c "npm run typecheck"`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/config/config.ts src/components/settings/sections/SettingsAppearanceSection.vue src/app/composables/app-shell/preferences.ts
git commit -m "feat(settings): 设置页新增纯白主题选项"
```

---

### Task 6: 全量验证

**Files:** 无

- [ ] **Step 1: 全量测试**

Run: `cmd /c "npm run typecheck"` 和 `cmd /c "npm run test"`
Expected: typecheck 无错误；vitest 全部 PASS（含新 apply 测试）

- [ ] **Step 2: 手动验证清单**

启动 `npm run dev`，逐项确认：

1. 设置 → 外观 → 主题切换出现「纯白」选项
2. 选择「纯白」：全界面背景为纯白 `#ffffff`，无米黄残留，卡片无阴影、靠边框区分
3. 金色点缀仍在：按钮、选中态、「今天」徽章、月历热力图、报告热力图
4. 系统主题改为深色后，选「纯白」的界面保持纯白不变；切回「跟随系统」恢复深色
5. 写作/报告/记账/设置/时间轴五个页面在纯白下均正常
6. 报告 → 导出 PNG：导出页与导出图片为纯白风格
7. 回归：切回「浅色」「深色」，「跟随系统」，视觉与改动前完全一致（token 文件未动）
