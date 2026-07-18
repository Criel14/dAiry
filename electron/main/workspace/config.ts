import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getWorkspaceConfigPath, getWorkspaceMetadataDir } from './paths'

export interface WorkspaceConfig {
  lastProfileRefresh?: string
}

async function readRawWorkspaceConfig(workspacePath: string): Promise<Record<string, unknown>> {
  try {
    const fileContent = await readFile(getWorkspaceConfigPath(workspacePath), 'utf-8')
    const parsedValue = JSON.parse(fileContent) as unknown

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {}
    }

    return parsedValue as Record<string, unknown>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }

    if (error instanceof SyntaxError) {
      console.warn('[workspace] workspace.json 内容损坏，将按空配置处理：', error.message)
      return {}
    }

    throw error
  }
}

export async function readWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig> {
  const rawConfig = await readRawWorkspaceConfig(workspacePath)

  return {
    lastProfileRefresh:
      typeof rawConfig.lastProfileRefresh === 'string' ? rawConfig.lastProfileRefresh : undefined,
  }
}

export async function updateWorkspaceConfig(
  workspacePath: string,
  patch: Partial<WorkspaceConfig>,
): Promise<void> {
  const rawConfig = await readRawWorkspaceConfig(workspacePath)
  const nextConfig = {
    ...rawConfig,
    ...patch,
  }

  await mkdir(getWorkspaceMetadataDir(workspacePath), { recursive: true })
  await writeFile(
    getWorkspaceConfigPath(workspacePath),
    JSON.stringify(nextConfig, null, 2),
    'utf-8',
  )
}
