import path from 'node:path'
import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { AiContextDocument, SaveAiContextInput } from '../../src/types/ai'

function getAiContextFilePath() {
  return path.join(app.getPath('userData'), 'ai-context.md')
}

function normalizeAiContextContent(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function readAiContext(): Promise<string> {
  try {
    const fileContent = await readFile(getAiContextFilePath(), 'utf-8')
    return normalizeAiContextContent(fileContent)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

export async function getAiContextDocument(): Promise<AiContextDocument> {
  return {
    content: await readAiContext(),
  }
}

export async function saveAiContext(input: SaveAiContextInput): Promise<AiContextDocument> {
  await mkdir(app.getPath('userData'), { recursive: true })

  const content = normalizeAiContextContent(input.content)
  await writeFile(getAiContextFilePath(), content, 'utf-8')

  return {
    content,
  }
}
