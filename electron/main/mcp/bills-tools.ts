import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listBillCategories, queryBills } from '../bills/service'
import type { BillsQueryRange } from '../../../src/types/bills'
import { resolveWorkspacePath, toErrorResult, toJsonTextResult, workspacePathSchema } from './helpers'

const rangeSchema = z
  .object({
    month: z.string().optional().describe('月份，格式 YYYY-MM'),
    year: z.string().optional().describe('年份，格式 YYYY'),
    start: z.string().optional().describe('开始日期，格式 YYYY-MM-DD'),
    end: z.string().optional().describe('结束日期，格式 YYYY-MM-DD'),
  })
  .strict()
  .refine(
    (value) => {
      const keys = (['month', 'year', 'start', 'end'] as const).filter((key) => value[key] !== undefined)
      if (keys.length === 0) {
        return false
      }
      if (keys.length === 2 && keys.includes('start') && keys.includes('end')) {
        return true
      }
      return keys.length === 1
    },
    {
      message: '请只提供一种时间范围：month（月份）/ year（年份）/ start+end（自定义区间）。',
    },
  )

type RangeSchema = z.infer<typeof rangeSchema>

function toRangeInput(range: RangeSchema): BillsQueryRange {
  if (range.month !== undefined) {
    return { month: range.month }
  }
  if (range.year !== undefined) {
    return { year: range.year }
  }
  return { start: range.start as string, end: range.end as string }
}

export function registerBillsTools(server: McpServer) {
  server.registerTool(
    'dairy_bills_query',
    {
      title: '查询记账账单（只读）',
      description:
        '按时间范围（月份/年份/自定义区间）查询账单明细，可按分类名精确匹配、类型（expense 支出 / income 收入 / transfer 不计入收支，理财等内部资金变动）与备注关键词筛选。返回区间聚合统计（收入/支出/结余/笔数）与明细；明细超过 limit 时截断并标记 truncated，但统计仍为全量。只读工具，不做任何修改。',
      inputSchema: {
        range: rangeSchema.describe(
          '时间范围：month { month: "YYYY-MM" } / year { year: "YYYY" } / start+end 自定义区间，三选一',
        ),
        category: z.string().optional().describe('分类名精确匹配，如"餐饮"；不传则查询全部分类'),
        type: z
          .enum(['expense', 'income', 'transfer'])
          .optional()
          .describe(
            '类型筛选：expense 支出 / income 收入 / transfer 不计入收支（理财等内部资金变动，不参与收支统计）',
          ),
        keyword: z.string().optional().describe('备注模糊匹配关键词，大小写不敏感'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(200)
          .describe('最多返回的账单明细条数，默认 200，上限 1000'),
        workspacePath: workspacePathSchema,
      },
    },
    async ({ range, category, type, keyword, limit, workspacePath }) => {
      try {
        const result = await queryBills({
          workspacePath: await resolveWorkspacePath(workspacePath),
          range: toRangeInput(range),
          category,
          type,
          keyword,
          limit,
        })
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'dairy_bills_categories',
    {
      title: '查询记账分类库',
      description:
        '读取记账分类库（内置 + 自定义），返回全部分类的类型（expense/income/transfer）、名称、颜色与图标。查询账单前可先读取此工具了解可用分类。',
      inputSchema: {
        workspacePath: workspacePathSchema,
      },
    },
    async ({ workspacePath }) => {
      try {
        const categories = await listBillCategories(await resolveWorkspacePath(workspacePath))
        return toJsonTextResult({ categories })
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )
}
