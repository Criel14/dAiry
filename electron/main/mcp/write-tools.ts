import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { readAppConfig } from '../app-config'
import { writeJournalEntryFull } from '../journal/write-flow'
import { generateRangeReport, getRangeReport } from '../report'
import { resolveTargetReportId, validateReportRange } from '../report/range'

const REPORT_PRESETS = ['month', 'year', 'custom'] as const
const REPORT_SECTIONS = [
  'stats',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'locationPatterns',
  'timePatterns',
] as const

// reportId -> 后台生成失败时的中文错误信息；生成成功后删除
const reportTaskErrors = new Map<string, string>()

async function resolveActiveWorkspace(): Promise<string> {
  const config = await readAppConfig()
  if (config.lastOpenedWorkspace) {
    return config.lastOpenedWorkspace
  }

  throw new Error('当前还没有打开的工作区，请先在 dAiry 中打开一个工作区。')
}

function toJsonTextResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function toErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : '操作失败，请稍后重试。'
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}

export function registerWriteTools(server: McpServer) {
  server.registerTool(
    'journal_write_entry',
    {
      title: '撰写日记（完整写入）',
      description:
        '把用户口述的正文真实写入 dAiry 日记（journal/YYYY/MM/YYYY-MM-DD.md），随后由 dAiry 主进程 AI 自动生成总结、标签与心情并回填，并异步维护用户画像与时间轴。这是写操作，会真实落盘；调用前务必与用户确认日期、天气、地点与写入模式。',
      inputSchema: {
        date: z.string().describe('日记日期，格式 YYYY-MM-DD'),
        body: z.string().describe('日记正文，保留用户原文语气与段落，不做润色'),
        weather: z.string().describe('当天天气，如"晴""多云"；由用户提供'),
        location: z.string().describe('当天地点，如"家""公司"；由用户提供'),
        mode: z
          .enum(['create', 'append', 'overwrite'])
          .default('create')
          .describe(
            'create：当日不存在时新建（已存在会报错）；append：追加到已有正文；overwrite：覆盖已有正文。append 与 overwrite 需用户明确授权',
          ),
        organize: z
          .boolean()
          .default(true)
          .describe('是否自动整理总结/标签/心情并异步维护画像与时间轴，默认 true'),
      },
    },
    async ({ date, body, weather, location, mode, organize }) => {
      try {
        const workspacePath = await resolveActiveWorkspace()
        const result = await writeJournalEntryFull({
          workspacePath,
          date,
          body,
          weather,
          location,
          mode,
          organize,
        })
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'report_generate',
    {
      title: '生成区间报告（异步）',
      description:
        '异步触发月报/年报/自定义区间报告生成，立即返回 reportId，不等待生成完成。生成需要几分钟时间，完成后报告落盘到工作区 reports/ 目录，请稍后使用 report_get 工具查询结果。同一 preset 同区间的月报/年报会覆盖旧报告。',
      inputSchema: {
        preset: z
          .enum(REPORT_PRESETS)
          .describe('报告类型：month 月报（覆盖完整自然月）、year 年报（覆盖完整自然年）、custom 自定义区间（跨度不超过 1 年）'),
        startDate: z.string().describe('开始日期，格式 YYYY-MM-DD'),
        endDate: z.string().describe('结束日期，格式 YYYY-MM-DD'),
        requestedSections: z
          .array(z.enum(REPORT_SECTIONS))
          .optional()
          .describe('要生成的 section，缺省为全部 6 个'),
      },
    },
    async ({ preset, startDate, endDate, requestedSections }) => {
      try {
        const workspacePath = await resolveActiveWorkspace()
        const input = {
          workspacePath,
          preset,
          startDate,
          endDate,
          requestedSections: requestedSections ?? [],
        }
        const { startDate: start, endDate: end, requestedSections: sections } =
          validateReportRange(input)
        const reportId = resolveTargetReportId(input, start, end)

        // 允许失败后重新提交：清除旧的失败记录
        reportTaskErrors.delete(reportId)

        void (async () => {
          try {
            await generateRangeReport({ ...input, requestedSections: sections })
            reportTaskErrors.delete(reportId)
          } catch (error) {
            reportTaskErrors.set(
              reportId,
              error instanceof Error ? error.message : '报告生成失败。',
            )
          }
        })()

        return toJsonTextResult({
          reportId,
          preset,
          status: 'submitted',
          notice: '报告生成需要几分钟时间，请稍后使用 report_get 工具查询结果。',
        })
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'report_get',
    {
      title: '读取区间报告',
      description:
        '按 reportId 读取已生成的区间报告 JSON（月报 reportId 形如 month_2026-07，年报形如 year_2026，自定义形如 custom_...，来自 report_generate 的返回值）。报告尚未生成或仍在生成中时返回错误提示。',
      inputSchema: {
        reportId: z.string().describe('报告 ID，来自 report_generate 返回值'),
      },
    },
    async ({ reportId }) => {
      try {
        const workspacePath = await resolveActiveWorkspace()
        const normalizedId = reportId.trim()
        const taskError = reportTaskErrors.get(normalizedId)
        if (taskError) {
          throw new Error(`报告生成失败：${taskError}`)
        }

        const report = await getRangeReport({ workspacePath, reportId: normalizedId })
        return toJsonTextResult(report)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return toErrorResult(new Error('报告尚未生成或仍在生成中，请稍后重试。'))
        }
        return toErrorResult(error)
      }
    },
  )
}
