import path from 'node:path'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import type { WorkspaceStringListInput } from '../../src/types/dairy'
import {
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_TAG_OPTIONS,
  DEFAULT_WEATHER_OPTIONS,
} from './constants'
import { normalizeStringList, readJournalDocument } from './journal-document'
import {
  getWorkspaceJournalDir,
  getWorkspaceLocationLibraryPath,
  getWorkspaceMetadataDir,
  getWorkspaceTagLibraryPath,
  getWorkspaceWeatherLibraryPath,
} from './workspace-paths'

interface WorkspaceTagLibrary {
  version: 1
  tags: string[]
}

interface WorkspaceWeatherLibrary {
  version: 1
  items: string[]
}

interface WorkspaceLocationLibrary {
  version: 1
  items: string[]
}

function sortChinese(items: string[]) {
  return [...items].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
}

function normalizeWorkspaceTagLibrary(rawValue: unknown): WorkspaceTagLibrary {
  if (!rawValue || typeof rawValue !== 'object') {
    return {
      version: 1,
      tags: [...DEFAULT_TAG_OPTIONS],
    }
  }

  const value = rawValue as Partial<WorkspaceTagLibrary>
  return {
    version: 1,
    tags: sortChinese(normalizeStringList(value.tags)),
  }
}

function normalizeWorkspaceWeatherLibrary(rawValue: unknown): WorkspaceWeatherLibrary {
  if (!rawValue || typeof rawValue !== 'object') {
    return {
      version: 1,
      items: [...DEFAULT_WEATHER_OPTIONS],
    }
  }

  const value = rawValue as Partial<WorkspaceWeatherLibrary>
  return {
    version: 1,
    items: sortChinese(normalizeStringList(value.items ?? DEFAULT_WEATHER_OPTIONS)),
  }
}

function normalizeWorkspaceLocationLibrary(rawValue: unknown): WorkspaceLocationLibrary {
  if (!rawValue || typeof rawValue !== 'object') {
    return {
      version: 1,
      items: [...DEFAULT_LOCATION_OPTIONS],
    }
  }

  const value = rawValue as Partial<WorkspaceLocationLibrary>
  return {
    version: 1,
    items: sortChinese(normalizeStringList(value.items)),
  }
}

async function listMarkdownFiles(rootPath: string): Promise<string[]> {
  try {
    const directoryEntries = await readdir(rootPath, { withFileTypes: true })
    const nestedResults = await Promise.all(
      directoryEntries.map(async (entry) => {
        const entryPath = path.join(rootPath, entry.name)
        if (entry.isDirectory()) {
          return listMarkdownFiles(entryPath)
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          return [entryPath]
        }

        return []
      }),
    )

    return nestedResults.flat()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function collectWorkspaceTagsFromJournalFiles(workspacePath: string) {
  const journalRoot = getWorkspaceJournalDir(workspacePath)
  const filePaths = await listMarkdownFiles(journalRoot)
  const tags = new Set<string>()

  for (const filePath of filePaths) {
    try {
      const document = await readJournalDocument(filePath)
      for (const tag of document.frontmatter.tags) {
        tags.add(tag)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      throw error
    }
  }

  return sortChinese([...tags])
}

async function ensureWorkspaceMetadataDir(workspacePath: string) {
  await mkdir(getWorkspaceMetadataDir(workspacePath), { recursive: true })
}

async function readWorkspaceTagLibrary(workspacePath: string): Promise<WorkspaceTagLibrary> {
  const tagLibraryPath = getWorkspaceTagLibraryPath(workspacePath)

  try {
    const fileContent = await readFile(tagLibraryPath, 'utf-8')
    return normalizeWorkspaceTagLibrary(JSON.parse(fileContent))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const initialTags = await collectWorkspaceTagsFromJournalFiles(workspacePath)
      const nextLibrary = normalizeWorkspaceTagLibrary({
        version: 1,
        tags: [...DEFAULT_TAG_OPTIONS, ...initialTags],
      })
      await writeWorkspaceTagLibrary(workspacePath, nextLibrary)
      return nextLibrary
    }

    throw error
  }
}

async function writeWorkspaceTagLibrary(workspacePath: string, library: WorkspaceTagLibrary) {
  await ensureWorkspaceMetadataDir(workspacePath)
  await writeFile(
    getWorkspaceTagLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceTagLibrary(library), null, 2),
    'utf-8',
  )
}

async function readWorkspaceWeatherLibrary(
  workspacePath: string,
): Promise<WorkspaceWeatherLibrary> {
  const weatherLibraryPath = getWorkspaceWeatherLibraryPath(workspacePath)

  try {
    const fileContent = await readFile(weatherLibraryPath, 'utf-8')
    return normalizeWorkspaceWeatherLibrary(JSON.parse(fileContent))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const nextLibrary = normalizeWorkspaceWeatherLibrary({
        version: 1,
        items: DEFAULT_WEATHER_OPTIONS,
      })
      await writeWorkspaceWeatherLibrary(workspacePath, nextLibrary)
      return nextLibrary
    }

    throw error
  }
}

async function writeWorkspaceWeatherLibrary(
  workspacePath: string,
  library: WorkspaceWeatherLibrary,
) {
  await ensureWorkspaceMetadataDir(workspacePath)
  await writeFile(
    getWorkspaceWeatherLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceWeatherLibrary(library), null, 2),
    'utf-8',
  )
}

async function readWorkspaceLocationLibrary(
  workspacePath: string,
): Promise<WorkspaceLocationLibrary> {
  const locationLibraryPath = getWorkspaceLocationLibraryPath(workspacePath)

  try {
    const fileContent = await readFile(locationLibraryPath, 'utf-8')
    return normalizeWorkspaceLocationLibrary(JSON.parse(fileContent))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const nextLibrary = normalizeWorkspaceLocationLibrary({
        version: 1,
        items: DEFAULT_LOCATION_OPTIONS,
      })
      await writeWorkspaceLocationLibrary(workspacePath, nextLibrary)
      return nextLibrary
    }

    throw error
  }
}

async function writeWorkspaceLocationLibrary(
  workspacePath: string,
  library: WorkspaceLocationLibrary,
) {
  await ensureWorkspaceMetadataDir(workspacePath)
  await writeFile(
    getWorkspaceLocationLibraryPath(workspacePath),
    JSON.stringify(normalizeWorkspaceLocationLibrary(library), null, 2),
    'utf-8',
  )
}

export async function mergeWorkspaceTags(workspacePath: string, tags: string[]) {
  const currentLibrary = await readWorkspaceTagLibrary(workspacePath)
  const nextLibrary = normalizeWorkspaceTagLibrary({
    version: 1,
    tags: [...currentLibrary.tags, ...tags],
  })

  await writeWorkspaceTagLibrary(workspacePath, nextLibrary)
}

export async function mergeWorkspaceWeatherOptions(workspacePath: string, items: string[]) {
  const currentLibrary = await readWorkspaceWeatherLibrary(workspacePath)
  const nextLibrary = normalizeWorkspaceWeatherLibrary({
    version: 1,
    items: [...currentLibrary.items, ...items],
  })

  await writeWorkspaceWeatherLibrary(workspacePath, nextLibrary)
}

export async function mergeWorkspaceLocationOptions(workspacePath: string, items: string[]) {
  const currentLibrary = await readWorkspaceLocationLibrary(workspacePath)
  const nextLibrary = normalizeWorkspaceLocationLibrary({
    version: 1,
    items: [...currentLibrary.items, ...items],
  })

  await writeWorkspaceLocationLibrary(workspacePath, nextLibrary)
}

export async function getWorkspaceTags(workspacePath: string) {
  const library = await readWorkspaceTagLibrary(workspacePath)
  return library.tags
}

export async function setWorkspaceTags(input: WorkspaceStringListInput) {
  const nextLibrary = normalizeWorkspaceTagLibrary({
    version: 1,
    tags: input.items,
  })

  await writeWorkspaceTagLibrary(input.workspacePath, nextLibrary)
  return nextLibrary.tags
}

export async function getWorkspaceWeatherOptions(workspacePath: string) {
  const library = await readWorkspaceWeatherLibrary(workspacePath)
  return library.items
}

export async function setWorkspaceWeatherOptions(input: WorkspaceStringListInput) {
  const nextLibrary = normalizeWorkspaceWeatherLibrary({
    version: 1,
    items: input.items,
  })

  await writeWorkspaceWeatherLibrary(input.workspacePath, nextLibrary)
  return nextLibrary.items
}

export async function getWorkspaceLocationOptions(workspacePath: string) {
  const library = await readWorkspaceLocationLibrary(workspacePath)
  return library.items
}

export async function setWorkspaceLocationOptions(input: WorkspaceStringListInput) {
  const nextLibrary = normalizeWorkspaceLocationLibrary({
    version: 1,
    items: input.items,
  })

  await writeWorkspaceLocationLibrary(input.workspacePath, nextLibrary)
  return nextLibrary.items
}
