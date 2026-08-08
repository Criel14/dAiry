import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { SaveSupplementInput, SupplementDocument } from '../../../src/types/ai'
import { getWorkspaceMetadataDir, getWorkspaceSupplementPath } from '../workspace/paths'

function normalizeSupplementContent(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function readSupplement(workspacePath: string): Promise<string> {
  try {
    const fileContent = await readFile(getWorkspaceSupplementPath(workspacePath), 'utf-8')
    return normalizeSupplementContent(fileContent)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

export async function getSupplementDocument(workspacePath: string): Promise<SupplementDocument> {
  return {
    content: await readSupplement(workspacePath),
  }
}

export async function saveSupplement(
  workspacePath: string,
  input: SaveSupplementInput,
): Promise<SupplementDocument> {
  await mkdir(getWorkspaceMetadataDir(workspacePath), { recursive: true })

  const content = normalizeSupplementContent(input.content)
  await writeFile(getWorkspaceSupplementPath(workspacePath), content, 'utf-8')

  return {
    content,
  }
}
