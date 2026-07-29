import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { readAppConfig } from '../app-config'
import {
  batchReadEntries,
  getMetaIndex,
  getUserProfile,
  grepDiaryText,
  searchMemory,
} from '../memory'

const YEAR_PATTERN = /^\d{4}$/

const workspacePathSchema = z
  .string()
  .optional()
  .describe('工作区根目录绝对路径；缺省时使用 dAiry 当前打开的工作区')

async function resolveWorkspacePath(rawWorkspacePath?: string): Promise<string> {
  const explicitWorkspacePath = typeof rawWorkspacePath === 'string' ? rawWorkspacePath.trim() : ''
  if (explicitWorkspacePath) {
    return explicitWorkspacePath
  }

  const config = await readAppConfig()
  if (config.lastOpenedWorkspace) {
    return config.lastOpenedWorkspace
  }

  throw new Error('当前还没有可用的工作区，请先在 dAiry 中打开一个工作区。')
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

export function createMemoryMcpServer(): McpServer {
  const server = new McpServer({ name: 'dairy-memory', version: '1.0.0' })

  server.registerTool(
    'memory_search',
    {
      title: '语义检索日记',
      description:
        '根据自然语言查询语义检索用户的日记，多阶段筛选后返回总结性回答、相关日期列表与置信度。需要已配置 AI。',
      inputSchema: {
        query: z.string().describe('自然语言查询，例如“上次面试是什么时候”'),
        years: z
          .array(z.string())
          .optional()
          .describe('限定检索年份，如 ["2025", "2026"]；缺省检索全部年份'),
        limit: z.number().int().optional().describe('最多展示的日记篇数，默认 10，上限 20'),
        workspacePath: workspacePathSchema,
      },
    },
    async ({ query, years, limit, workspacePath }) => {
      try {
        const result = await searchMemory({
          workspacePath: await resolveWorkspacePath(workspacePath),
          query,
          years,
          limit,
        })
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'memory_batch_read_entries',
    {
      title: '批量读取日记正文',
      description:
        '按日期批量读取日记正文与元信息（摘要/标签/心情）。返回 entries 与 skippedDates（格式无效或当天无日记的日期）。',
      inputSchema: {
        dates: z.array(z.string()).describe('日期列表，格式 YYYY-MM-DD'),
        workspacePath: workspacePathSchema,
      },
    },
    async ({ dates, workspacePath }) => {
      try {
        const result = await batchReadEntries(await resolveWorkspacePath(workspacePath), dates)
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'memory_grep_diary',
    {
      title: '关键词检索日记',
      description:
        '按关键词在全部日记正文（不含 frontmatter 元信息）中做大小写不敏感的字面匹配，返回命中日期、当日摘要与正文上下文片段。适合精确词检索，不需要 AI。',
      inputSchema: {
        keyword: z.string().describe('要匹配的关键词'),
        workspacePath: workspacePathSchema,
      },
    },
    async ({ keyword, workspacePath }) => {
      try {
        const result = await grepDiaryText(await resolveWorkspacePath(workspacePath), keyword)
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'memory_get_user_profile',
    {
      title: '读取用户画像',
      description:
        '读取由 dAiry 自动维护的用户画像 Markdown（长期偏好、习惯、进行中的项目等），取最新年份版本。',
      inputSchema: {
        workspacePath: workspacePathSchema,
      },
    },
    async ({ workspacePath }) => {
      try {
        const result = await getUserProfile(await resolveWorkspacePath(workspacePath))
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  server.registerTool(
    'memory_get_meta_index',
    {
      title: '读取年度元索引',
      description:
        '读取指定年份的日记元索引（每篇日记的摘要、标签、心情、地点、字数），适合先概览再决定精读哪些日期。',
      inputSchema: {
        year: z.string().describe('年份，格式 YYYY'),
        workspacePath: workspacePathSchema,
      },
    },
    async ({ year, workspacePath }) => {
      try {
        const normalizedYear = year.trim()
        if (!YEAR_PATTERN.test(normalizedYear)) {
          throw new Error('年份格式无效，必须为 YYYY。')
        }

        const result = await getMetaIndex(await resolveWorkspacePath(workspacePath), normalizedYear)
        return toJsonTextResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    },
  )

  return server
}
