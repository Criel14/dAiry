# dAiry 记账功能设计文档

日期：2026-08-09
状态：已与用户逐节确认

## 1. 背景与目标

dAiry 目前是面向程序员的本地桌面日记工具（写作 / 报告 / 时间轴 / 设置 / 工作区五大视图）。用户日常用 Excel + Python 脚本 + HTML 的方式做简单记账（`D:\Document\记账`），现在希望把记账能力集成进 dAiry，形成完整闭环。

目标：

- 在 dAiry 中新增「记账」一级视图：浏览明细、统计图表、日常录入（新增 / 编辑 / 删除）、导出 Excel
- 数据存储使用 SQLite（better-sqlite3），跟随工作区，不用 Excel 作为数据源
- 导出 Excel 的格式与用户现有 `account.xlsx` 完全一致（sheet 按年份命名，列：日期、金额、分类、备注）
- UI 风格与 dAiry 现有主题体系匹配；图表内容与现有 HTML 展示一致

非目标（YAGNI，本期不做）：

- 不做 Excel 导入（用户明确不需要迁移旧数据，从零开始记账）
- 不做 MCP 暴露记账能力
- 不做预算、月结、多账本、报表模板等扩展
- 不做分类图标/颜色自定义选择（新增分类自动分配默认值）

## 2. 总体架构

采用独立业务域模块方案（已确认），与 journal / report / timeline 组织方式一致：

- **渲染进程**：`src/components/bills/` 业务域 + `RightPanel` 扩展 `'bills'` + ActivityBar 新增「记账」导航项
- **主进程**：`electron/main/bills/`（db / categories / service / export 四模块）+ `electron/main/ipc/bills.ts` 注册
- **共享层**：`src/shared/ipc-channels.ts` 新增 `bills:*` 通道常量；`src/types/bills.ts` 新增共享类型；`src/types/api.ts` 的 `DairyApi` 扩展；`electron/preload.ts` 暴露受限 API
- **数据位置**（已确认）：
  - 账单库：`<工作区>/bills/bills.db`（与 `journal/` 同级，`.dairy/` 只放配置类文件）
  - 分类库：`<工作区>/.dairy/bill-categories.json`

## 3. 数据模型

### 3.1 账单表（SQLite，`<工作区>/bills/bills.db`）

```sql
CREATE TABLE bills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,          -- 'YYYY-MM-DD'
  amount_cents  INTEGER NOT NULL,          -- 金额以「分」为单位的整数；负数=支出，正数=收入
  category      TEXT    NOT NULL,          -- 分类名（冗余存储，不关联外键）
  note          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);
CREATE INDEX idx_bills_date ON bills(date);
```

关键决策：

- 金额用「分」整数存储（23.46 元 → 2346），避免浮点误差，统计求和精确；UI 显示统一保留 2 位小数（`±23.46`）
- 账单冗余存储分类名而非外键：分类改名/删除不影响历史账单的文字内容
- schema 版本用 `PRAGMA user_version` 管理，为未来扩展留口子
- SQLite 开启 WAL 模式；连接按工作区懒初始化，切换工作区时重建连接；写入用事务

### 3.2 分类库（JSON，`<工作区>/.dairy/bill-categories.json`）

```json
{
  "version": 1,
  "categories": [
    { "type": "expense", "name": "餐饮", "color": "#5E8C61", "icon": "utensils", "builtin": true },
    { "type": "income",  "name": "工资", "color": "#5A9F61", "icon": "wallet",  "builtin": true },
    { "type": "transfer", "name": "理财", "color": "#8A7FA8", "icon": "piggy-bank", "builtin": true }
  ]
}
```

- 文件不存在时首次读取自动播种内置分类（含三类型的「其他」兜底分类）
- `builtin: true` 的内置分类：不可删除、不可改名、样式固定默认值
- 自定义分类：可新增、改名、删除；新增时只输入名字，系统从色板自动分配未使用的颜色和默认图标，不提供图标/颜色选择（已确认）

### 3.3 分类体系（内置分类，已确认）

| type | 分类 | 说明 |
|---|---|---|
| expense 支出 | 餐饮、交通、购物、教育、服务、娱乐、生活缴费、医疗、转账、公益、其他 | 「其他」为兜底 |
| income 收入 | 工资、生意、奖金、转账、其他 | 「其他」为兜底 |
| transfer 不计入收支 | 理财、其他 | 「其他」为兜底 |

- 「转账」在支出与收入中都存在（转出算支出、转入算收入），重名合法，靠 type 区分
- transfer 类型（理财等）记录：明细照常显示、Excel 照常导出，但**不计入**统计卡片与图表（结余才真实）

### 3.4 分类匹配规则（渲染与统计）

账单只存分类名，渲染/聚合时按以下三步解析（解决「转账」重名与分类被删/改名的兜底）：

1. 按 **（金额符号 → 类型, 分类名）** 精确匹配：`amount < 0` 先查 expense 分类，`amount >= 0` 先查 income 分类
2. 第一步未命中 → 按 name 全表查（捕获「理财」这类 transfer 分类）
3. 仍未命中（分类被删/改名）→ 按符号映射类型的「其他」兜底样式渲染，文字仍显示原分类名

### 3.5 分类删除策略（已确认）

- 物理删除：删除即从 JSON 移除，分类 JSON 永远干净，不堆积废弃项
- 删除后历史账单：文字仍显示原分类名，颜色/图标按 3.4 规则回退到对应类型的「其他」样式
- 删除分类时 UI 提示「历史账单将回退为其他样式」；删除前确认

## 4. 界面结构

### 4.1 导航

ActivityBar 新增「记账」导航项（lucide 图标，如 `Wallet`），`RightPanel` 扩展 `'bills'`。`AppShellPage.vue` 与 `useAppShell` 增加对应分支与打开函数。

### 4.2 左侧栏 BillsSidebar（无工作区时显示引导，与报告页一致）

- **月度选择器**：年份切换（双箭头）+ 12 月网格 + 「回到本月」按钮，交互与 ReportsSidebar 月度选择器一致；实现方式为复制月份逻辑到本业务域（方案 2，已确认：不改动 ReportsSidebar，接受 ~50 行重复代码）
- **分类管理**（可展开面板）：
  - 按三类分组展示分类列表（色块 + 图标 + 名）
  - 新增：选类型（支出/收入/不计入收支）+ 输入名字，自动分配默认颜色/图标
  - 自定义分类可改名、可删除；内置分类只读展示
- **导出 Excel** 按钮：点击后主进程弹保存对话框

### 4.3 主区域 BillsPanel

- 顶栏：Tab「明细 / 统计」+ 「记一笔」按钮
- **明细 tab**（选中月份）：
  - 汇总条：`2026年8月 · 共 N 笔 · 支出 X · 收入 Y`
  - 按天分组卡片：日期 + 星期 ｜ 支出/收入小计；每行记录：分类色块图标 + 分类 + 备注 + 金额（`±xx.xx` 两位小数）；行 hover 出现 编辑/删除 操作
  - 无记录时显示空态占位
- **统计 tab**：
  - 「本月 / 全年」视角切换（选中月份 → 本月视角；全年视角聚合全年数据）
  - 3 个统计卡片：总支出 / 总收入 / 结余（transfer 类型排除在外）
  - 图表（ECharts，见第 5 节）：
    - 分类支出占比环形图（本月：当月分类占比；全年：年度分类占比）
    - 支出柱状图（本月视角：按日；全年视角：按 12 个月）
    - 近 6 个月支出对比柱状图（仅本月视角显示，近 6 个月含跨年）
  - 无支出数据时显示空态占位（与 HTML 的 emptyOption 行为一致）
- **录入/编辑弹窗（Modal）**：日期（默认今天）、支出/收入/不计入收支切换、金额（元，输入限制 2 位小数）、分类下拉（按所选类型过滤，转账类记录计入收支统计）、备注（可空）

## 5. 图表实现（ECharts，已确认引入）

- 新增 `echarts` 依赖（纯前端包，vite 正常打包）
- 按需引入：`echarts/core` + `PieChart` / `BarChart` + Tooltip / Legend / Grid 组件，控制体积
- 图表类型与用户 HTML 一致：环形图 `radius ['50%','78%']`、图例底部、标签 `{b} {d}%`；柱状图圆角、tooltip 显示金额
- **主题适配**：分类色来自分类 JSON；图表文字/轴线/分割线颜色从项目 CSS token 读取（如 `--color-text-chart-neutral`、`--color-border-*`）；监听 `html[data-theme]` 变化后 `setOption` 重绘，深色主题跟随变色
- 图表容器随窗口缩放 resize

## 6. 导出 Excel（exceljs，纯 JS 零原生依赖）

- 主进程生成 xlsx，结构与用户现有 `account.xlsx` 一致：
  - sheet 按年份命名（2026、2027...），无数据年份不建 sheet
  - 列：日期（文本 `YYYY-MM-DD`）、金额（数字，支出为负）、分类、备注
  - 支出/收入/不计入收支全部导出，正负号保留语义，不加额外列
- 流程：侧栏「导出 Excel」→ IPC → 主进程查全部账单 → exceljs 组装 → 系统保存对话框（默认文件名 `bills.xlsx`）→ 写盘 → 返回结果
- 用户取消 → 静默返回 `{ canceled: true }`；写盘失败 → 返回可读中文错误，不影响任何数据
- 导出失败不做无限重试（与报告 PNG 导出约束一致）

## 7. 主进程模块与 IPC

### 7.1 模块结构 `electron/main/bills/`

```
bills/
  db.ts         -- better-sqlite3 连接管理（懒初始化、user_version 迁移、WAL、事务）
  categories.ts -- 分类 JSON 读写与播种内置分类、色板分配
  service.ts    -- 账单 CRUD、按年/月查询、导出数据组装
  export.ts     -- exceljs 生成 xlsx + 保存对话框
```

### 7.2 IPC 通道（`bills:*`）

```
bills:list-month        { workspacePath, month } → Bill[]
bills:list-year         { workspacePath, year } → Bill[]   （统计聚合在前端完成）
bills:create            { workspacePath, date, amountCents, category, note } → Bill
bills:update            { workspacePath, id, date, amountCents, category, note } → Bill
bills:delete            { workspacePath, id } → void
bills:get-categories    { workspacePath } → Category[]
bills:create-category   { workspacePath, type, name } → Category[]   （自动分配颜色/图标）
bills:update-category   { workspacePath, type, name, newName } → Category[]   （仅改名，builtin 拒绝）
bills:delete-category   { workspacePath, type, name } → Category[]   （builtin 与「其他」拒绝）
bills:export-excel      { workspacePath } → { path: string | null, canceled: boolean }
```

- 写操作全部在主进程校验：日期格式与合法性、金额 > 0（正负由类型切换决定）、分类必须存在于所选类型、备注可空
- 失败返回可读中文错误；校验失败不落库
- 统计聚合在前端完成：`list-year` 拉回整年记录（数据量小），按 3.4 匹配规则解析分类并聚合

## 8. 依赖与打包（better-sqlite3 原生模块处理）

- `better-sqlite3` 加入 dependencies
- `@electron/rebuild` 加入 devDependencies；`package.json` 增加 `postinstall` 脚本执行 `electron-builder install-app-deps`，使二进制匹配 Electron ABI
- `electron-builder.json5` 增加 `asarUnpack: ["**/node_modules/better-sqlite3/**"]`
- 开发机需要一次性安装 VS Build Tools（C++ 工具链）编译原生模块；**最终用户无需任何工具链**（安装包内置编译好的二进制）
- 项目为 ESM（`"type": "module"`），主进程通过 ESM-CJS interop 引入 better-sqlite3（`import Database from 'better-sqlite3'`）

## 9. 边界与错误处理

- 无工作区：记账页显示引导提示（复用报告页模式），不初始化数据库
- `<工作区>/bills/` 目录不存在时自动创建（`mkdir recursive`）
- 账单删除弹确认；分类删除弹确认并提示兜底行为
- 金额输入限制 2 位小数；显示统一 `±xx.xx`
- SQLite 初始化/写入失败返回可读中文错误，不影响日记等其他功能
- 切工作区时重建 SQLite 连接与分类缓存

## 10. 需同步更新的文件清单

- `src/types/ui.ts`：`RightPanel` 增加 `'bills'`
- `src/shared/ipc-channels.ts`：新增 `bills:*` 通道
- `src/types/bills.ts`：新增（Bill / Category / 各输入输出类型）
- `src/types/api.ts`：`DairyApi` 扩展
- `electron/preload.ts`：暴露记账 API
- `electron/main/ipc/index.ts`：注册 bills handlers
- `src/app/components/ActivityBar/ActivityBar.vue`：新增导航项
- `src/app/composables/useAppShell.ts` 与 `AppShellPage.vue`：新增页面分支
- `package.json`：依赖与 postinstall
- `electron-builder.json5`：asarUnpack
- `AGENTS.md`：更新工作区结构约定、功能列表、架构边界（记账业务域、bills/ 目录、.dairy/bill-categories.json、better-sqlite3 打包约束）
- `vite.config.ts`：检查无需改动（better-sqlite3 仅在主进程使用，不参与 renderer 打包）
