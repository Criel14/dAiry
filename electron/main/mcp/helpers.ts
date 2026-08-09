import { z } from 'zod'
import { readAppConfig } from '../app-config'

export const workspacePathSchema = z
  .string()
  .optional()
  .describe('工作区根目录绝对路径；缺省时使用 dAiry 当前打开的工作区')

export async function resolveWorkspacePath(rawWorkspacePath?: string): Promise<string> {
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

export function toJsonTextResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

export function toErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : '操作失败，请稍后重试。'
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}
