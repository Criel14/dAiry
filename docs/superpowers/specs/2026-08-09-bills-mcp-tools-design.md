# 记账 MCP 查询工具设计

日期：2026-08-09

## 1. 背景与目标

记账功能（`electron/main/bills/`）目前没有暴露任何 MCP 工具给 AI。本设计新增**只读**查询工具，供聊天应用接入后由 AI 自主分析（"这个月花了多少"、"餐饮开销多大"等）。只提供底层查询能力，不提供写工具，不做业务分析（分析交给 AI）。

非目标：

- 不提供任何记账写工具（录入/修改/删除/分类管理）
- 不改动 `transfer` 类型的数据模型命名（历史命名，语义为"不计入收支"，迁移属另一任务）

## 2. 工具设计

### 2.1 `dairy_bills_query`（综合查询）

参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `range` | 是 | 互斥范围之一：`{ month: "YYYY-MM" }` / `{ year: "YYYY" }` / `{ start, end }`（自定义区间，`YYYY-MM-DD`）；冲突时报错 |
| `category` | 否 | 分类名精确匹配 |
| `type` | 否 | `expense` 支出 / `income` 收入 / `transfer` 不计入收支（理财等内部资金变动，不参与收支统计）。按分类三步匹配解析后的类型过滤，与 UI 一致 |
| `keyword` | 否 | 备注大小写不敏感模糊匹配 |
| `limit` | 否 | 明细条数上限，默认 200，最大 1000 |
| `workspacePath` | 否 | 工作区根目录绝对路径；缺省用 dAiry 当前打开的工作区 |

语义约定：

- `type` 过滤在 SQL 之后、limit 截断之前执行，避免截断误伤
- 分类不存在 → 空结果不报错（查询宽容）
- 从未记账 / 无匹配 → 空结果不报错
- `transfer` 类型不计入 `summary.income/expense/net`
- 月/年范围展开为起止日期返回

返回结构（金额以「元」为主，避免 AI 分/元换算出错）：

```json
{
  "range": { "start": "2026-01-01", "end": "2026-01-31" },
  "filter": { "category": null, "type": null, "keyword": null },
  "summary": { "income": 12345.67, "expense": 8901.23, "net": 3444.44, "count": 42 },
  "truncated": false,
  "limit": 200,
  "records": [
    { "id": 1, "date": "2026-01-05", "amountCents": -3550, "amount": -35.5, "category": "餐饮", "note": "午饭" }
  ]
}
```

字段含义：

- `range`：实际生效的查询时间范围
- `filter`：回显本次使用的筛选条件
- `summary.income`：收入合计（元）；`summary.expense`：支出合计（元，负数取绝对值累加）；`summary.net`：结余 = income − expense
- `summary.count`：筛选后的总笔数（含 transfer，仅反映记录量，不参与收支合计）
- `truncated`：明细是否因超过 limit 被截断；为 true 时 summary 仍是全量统计
- `records[].amountCents`：金额（分，整数），事实值，负数=支出、正数=收入
- `records[].amount`：金额（元，浮点），AI 引用用此字段
- `records[].category`：分类名；`records[].note`：备注（可为空）

### 2.2 `dairy_bills_categories`（分类库）

参数仅 `workspacePath`。返回内置 + 自定义全部分类：

```json
{
  "categories": [
    { "type": "expense", "name": "餐饮", "color": "#5E8C61", "icon": "utensils", "builtin": true }
  ]
}
```

AI 查账前可先读此工具了解有哪些分类。

## 3. 实现位置

- `src/shared/bills-logic.ts`：新增纯逻辑
  - `filterBillsByType(records, type, categories)`：按解析后类型过滤
  - `toBillQueryRecord(bill)`：Bill → 查询记录（附 amount 元值）
  - `buildSummary(records, categories)`：可复用的聚合（或直接复用 `aggregateRecords` + 元格式化）
- `electron/main/bills/service.ts`：新增 `queryBills(input)`，SQL 处理 date 范围 + category 精确 + keyword LIKE，JS 层处理 type 过滤与聚合
- `electron/main/mcp/helpers.ts`（新文件）：从 `tools.ts` 提取共享的 `resolveWorkspacePath` / `toJsonTextResult` / `toErrorResult`
- `electron/main/mcp/bills-tools.ts`（新文件）：`registerBillsTools(server)`，注册上述两个工具
- `electron/main/mcp/tools.ts`：改 import 共享 helper
- `electron/main/mcp/server.ts`：调用 `registerBillsTools(mcpServer)`
- `AGENTS.md`：MCP 约束段落补充记账只读工具说明

## 4. 测试

- `tests/bills/logic.test.ts`：为 `filterBillsByType`（含 transfer 不计收支、符号与分类名匹配）、`toBillQueryRecord` 等纯逻辑补用例
- db 层（better-sqlite3，Node 不可加载）不写单测，与既有约定一致
- 不改动任何写工具

## 5. 错误处理

- 范围格式非法（月份/年份/日期）：返回可读中文错误
- 多范围参数同时提供：报错提示互斥
- `limit` 越界（>1000 或 <1）：zod 校验兜底
