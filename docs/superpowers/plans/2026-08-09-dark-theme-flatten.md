# 深色主题扁平化优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化现有深色主题：卡片阴影清零、弹窗阴影减弱保留、报告渐变改近纯色、图表网格线深色下可见；色板与 light/pure 零影响。

**Architecture:** 仅修改 `src/shared/theme/tokens/dark.css` 中 20 个装饰性 token 的值（阴影 16 个、渐变 4 个、网格线 2 个——action/side-panel 渐变确认保留）。透明值写法与 pure.css 一致：`0 0 0 rgba(0, 0, 0, 0)`。

**Tech Stack:** CSS custom properties（`src/shared/theme/tokens/`），无 TS/测试改动。

**Spec:** `docs/superpowers/specs/2026-08-09-dark-theme-flatten-design.md`

---

### Task 1: dark.css token 修改

**Files:**
- Modify: `src/shared/theme/tokens/dark.css`（第 15-17、144-148、215-233 行区域）

- [ ] **Step 1: foundation 阴影清零**

`dark.css` 第 15-16 行：

```css
  --shadow-soft: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-medium: 0 0 0 rgba(0, 0, 0, 0);
```

（`--overlay-scrim: rgba(0, 0, 0, 0.58)` 不动）

- [ ] **Step 2: 卡片阴影清零 + 弹窗减弱**

`dark.css` 第 215-233 行整块替换为：

```css
  --shadow-soft-sm: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-soft-xs: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-popover: 0 10px 24px rgba(0, 0, 0, 0.22);
  --shadow-slider-thumb: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-slider-thumb-hover: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-tag-cloud: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-hero: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-card-soft: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-card-soft-strong: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-hover: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-cta: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-report-modal: 0 16px 36px rgba(0, 0, 0, 0.28);
  --shadow-modal: 0 16px 36px rgba(0, 0, 0, 0.28);
  --shadow-chart-point: 0 0 0 rgba(0, 0, 0, 0);
  --shadow-chart-tooltip: 0 10px 24px rgba(0, 0, 0, 0.24);
```

- [ ] **Step 3: 报告渐变改近纯色**

`dark.css` 第 185-191 行 `--gradient-report-hero` 替换为：

```css
  --gradient-report-hero: linear-gradient(180deg, #141920, #0d1014);
```

第 197-201 行 `--gradient-report-summary` 替换为：

```css
  --gradient-report-summary: linear-gradient(180deg, #141920, #10151b);
```

第 202-206 行 `--gradient-report-card` 替换为：

```css
  --gradient-report-card: linear-gradient(180deg, #141920, #10151b);
```

第 207-211 行 `--gradient-report-card-hover` 替换为：

```css
  --gradient-report-card-hover: linear-gradient(180deg, #1a2029, #141a21);
```

（`--gradient-report-action` / `--gradient-report-side-panel` / `--gradient-report-divider` 保留不动）

- [ ] **Step 4: 图表网格线可见**

`dark.css` 第 147-148 行：

```css
  --color-glass-shadow-42: rgba(255, 255, 255, 0.06);
  --color-glass-shadow-62: rgba(255, 255, 255, 0.09);
```

- [ ] **Step 5: 构建验证**

Run: `cmd /c "npx vite build"`
Expected: 构建成功（无 CSS 语法错误）

- [ ] **Step 6: 确认改动范围**

Run: `git diff --stat src/shared/theme/tokens/dark.css`
Expected: 仅 dark.css 一个文件；`git status` 无其他改动

- [ ] **Step 7: Commit**

```bash
git add src/shared/theme/tokens/dark.css
git commit -m "style(theme): 深色主题扁平化，卡片阴影清零、报告渐变近纯色"
```

---

### Task 2: 全量验证

**Files:** 无

- [ ] **Step 1: 回归检查**

Run: `cmd /c "npm run typecheck"` 和 `cmd /c "npm run test"`
Expected: typecheck 无错误；43 个测试全部 PASS

- [ ] **Step 2: 确认其他主题零影响**

Run: `git show --stat HEAD` 确认本实施只改动 dark.css；light/pure token 文件（foundation/surfaces/content/effects/pure）在本次提交中无 diff

- [ ] **Step 3: 手动验证清单**

启动 `npm run dev`，深色主题下逐项确认：

1. 各页面（写作/报告/记账/设置/时间轴）卡片无阴影，层次靠边框
2. 报告页 hero 卡片、历史报告卡、导出对话框无高光渐变，为纯深色表面
3. 弹窗（设置弹窗、模态框、报告导出预览）保留轻阴影
4. 情绪趋势图网格线可见
5. 切回浅色/纯白主题视觉与之前一致
