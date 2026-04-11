import path from 'node:path'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import type { JournalEntryMetadata, JournalFrontmatter } from '../../src/types/dairy'
import { EMPTY_METADATA } from './constants'

export function normalizeStringList(items: unknown) {
  if (!Array.isArray(items)) {
    return []
  }

  const uniqueItems = new Set<string>()

  for (const item of items) {
    if (typeof item !== 'string') {
      continue
    }

    const normalizedItem = item.trim()
    if (!normalizedItem) {
      continue
    }

    uniqueItems.add(normalizedItem)
  }

  return [...uniqueItems]
}

export function normalizeJournalMetadata(input: Partial<JournalEntryMetadata> | null | undefined) {
  return {
    weather: typeof input?.weather === 'string' ? input.weather.trim() : '',
    location: typeof input?.location === 'string' ? input.location.trim() : '',
    summary: typeof input?.summary === 'string' ? input.summary.trim() : '',
    tags: normalizeStringList(input?.tags),
  }
}

export function normalizeJournalFrontmatter(
  input: Partial<JournalFrontmatter> | null | undefined,
  fallbackTimestamps?: { createdAt: string; updatedAt: string },
): JournalFrontmatter {
  const now = new Date().toISOString()
  const metadata = normalizeJournalMetadata(input)

  return {
    ...metadata,
    createdAt:
      typeof input?.createdAt === 'string' && input.createdAt.trim()
        ? input.createdAt
        : fallbackTimestamps?.createdAt ?? now,
    updatedAt:
      typeof input?.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt
        : fallbackTimestamps?.updatedAt ?? fallbackTimestamps?.createdAt ?? now,
  }
}

export function createDefaultFrontmatter() {
  const now = new Date().toISOString()

  return normalizeJournalFrontmatter(
    {
      ...EMPTY_METADATA,
      createdAt: now,
      updatedAt: now,
    },
    {
      createdAt: now,
      updatedAt: now,
    },
  )
}

function extractFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/)
  if (!match) {
    return {
      frontmatterText: null,
      body: content,
    }
  }

  return {
    frontmatterText: match[1],
    body: content.slice(match[0].length),
  }
}

function parseYamlString(rawValue: string) {
  const trimmedValue = rawValue.trim()

  if (!trimmedValue) {
    return ''
  }

  if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    try {
      return JSON.parse(trimmedValue) as string
    } catch {
      return trimmedValue.slice(1, -1)
    }
  }

  if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    return trimmedValue.slice(1, -1).replace(/''/g, "'")
  }

  return trimmedValue
}

function parseInlineStringArray(rawValue: string) {
  const trimmedValue = rawValue.trim()
  if (trimmedValue === '[]') {
    return []
  }

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return []
  }

  const innerValue = trimmedValue.slice(1, -1).trim()
  if (!innerValue) {
    return []
  }

  return innerValue.split(',').map((item) => parseYamlString(item))
}

function parseFrontmatterBlock(frontmatterText: string): Partial<JournalFrontmatter> {
  const parsedResult: Partial<JournalFrontmatter> = {}
  let activeListKey: 'tags' | null = null

  for (const line of frontmatterText.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const listItemMatch = line.match(/^\s*-\s*(.*)$/)
    if (listItemMatch && activeListKey === 'tags') {
      const existingTags = parsedResult.tags ?? []
      parsedResult.tags = [...existingTags, parseYamlString(listItemMatch[1])]
      continue
    }

    const keyValueMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/)
    if (!keyValueMatch) {
      activeListKey = null
      continue
    }

    const [, key, rawValue = ''] = keyValueMatch
    activeListKey = null

    if (key === 'tags') {
      if (!rawValue.trim()) {
        parsedResult.tags = []
        activeListKey = 'tags'
        continue
      }

      parsedResult.tags = parseInlineStringArray(rawValue)
      continue
    }

    if (
      key === 'createdAt' ||
      key === 'updatedAt' ||
      key === 'weather' ||
      key === 'location' ||
      key === 'summary'
    ) {
      parsedResult[key] = parseYamlString(rawValue)
    }
  }

  return parsedResult
}

function stringifyYamlString(value: string) {
  return JSON.stringify(value)
}

function serializeFrontmatter(frontmatter: JournalFrontmatter) {
  const lines = [
    '---',
    `createdAt: ${stringifyYamlString(frontmatter.createdAt)}`,
    `updatedAt: ${stringifyYamlString(frontmatter.updatedAt)}`,
    `weather: ${stringifyYamlString(frontmatter.weather)}`,
    `location: ${stringifyYamlString(frontmatter.location)}`,
    `summary: ${stringifyYamlString(frontmatter.summary)}`,
  ]

  if (frontmatter.tags.length === 0) {
    lines.push('tags: []')
  } else {
    lines.push('tags:')
    for (const tag of frontmatter.tags) {
      lines.push(`  - ${stringifyYamlString(tag)}`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}

export function serializeJournalDocument(frontmatter: JournalFrontmatter, body: string) {
  const normalizedBody = body.replace(/\r\n/g, '\n')
  return `${serializeFrontmatter(frontmatter)}\n${normalizedBody}`
}

export async function readJournalDocument(filePath: string) {
  const [fileContent, fileStats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)])
  const { frontmatterText, body } = extractFrontmatter(fileContent)
  const parsedFrontmatter = frontmatterText ? parseFrontmatterBlock(frontmatterText) : null

  return {
    frontmatter: normalizeJournalFrontmatter(parsedFrontmatter, {
      createdAt: fileStats.birthtime.toISOString(),
      updatedAt: fileStats.mtime.toISOString(),
    }),
    body,
  }
}

export async function readJournalDocumentOrDefault(filePath: string) {
  try {
    return await readJournalDocument(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        frontmatter: createDefaultFrontmatter(),
        body: '',
      }
    }

    throw error
  }
}

export async function writeJournalDocument(
  filePath: string,
  frontmatter: JournalFrontmatter,
  body: string,
) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, serializeJournalDocument(frontmatter, body), 'utf-8')
}

export function countJournalWords(body: string) {
  const bodyContent = body.trim()

  if (!bodyContent) {
    return 0
  }

  return bodyContent.replace(/\s+/g, '').length
}
