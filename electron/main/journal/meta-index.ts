import path from 'node:path'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import type { JournalFrontmatter, JournalMetaIndex, JournalMetaRebuildResult } from '../../../src/types/journal'
import { countJournalWords, extractFrontmatter, parseFrontmatterBlock, normalizeJournalFrontmatter } from './document'
import { getWorkspaceJournalDir } from '../workspace/paths'

function getMetaIndexPath(workspacePath: string, year: string) {
  return path.join(getWorkspaceJournalDir(workspacePath), year, 'journal-meta.json')
}

export async function readJournalMetaIndex(workspacePath: string, year: string): Promise<JournalMetaIndex | null> {
  const filePath = getMetaIndexPath(workspacePath, year)

  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as JournalMetaIndex
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeJournalMetaIndex(workspacePath: string, index: JournalMetaIndex): Promise<void> {
  const filePath = getMetaIndexPath(workspacePath, index.year)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8')
}

export async function updateJournalMetaEntry(
  workspacePath: string,
  date: string,
  frontmatter: JournalFrontmatter,
  body: string,
): Promise<void> {
  const [year, mm, dd] = date.split('-')
  const key = `${mm}-${dd}`

  const existing = await readJournalMetaIndex(workspacePath, year)

  const entries = existing?.entries ?? {}
  entries[key] = {
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
    weather: frontmatter.weather,
    location: frontmatter.location,
    mood: frontmatter.mood,
    summary: frontmatter.summary,
    tags: [...frontmatter.tags],
    wordCount: countJournalWords(body),
  }

  const index: JournalMetaIndex = {
    version: 1,
    year,
    updatedAt: new Date().toISOString(),
    entries,
  }

  await writeJournalMetaIndex(workspacePath, index)
}

export async function rebuildJournalMetaIndex(
  workspacePath: string,
): Promise<JournalMetaRebuildResult> {
  const journalDir = getWorkspaceJournalDir(workspacePath)
  const yearPattern = /^\d{4}$/

  let yearDirs: string[]
  try {
    yearDirs = (await readdir(journalDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && yearPattern.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return { yearCount: 0, entryCount: 0 }
  }

  let totalEntries = 0

  for (const year of yearDirs) {
    const yearDir = path.join(journalDir, year)
    const entries: JournalMetaIndex['entries'] = {}

    let monthDirs: string[]
    try {
      monthDirs = (await readdir(yearDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch {
      continue
    }

    for (const month of monthDirs) {
      const monthDir = path.join(yearDir, month)
      let files: string[]
      try {
        files = await readdir(monthDir)
      } catch {
        continue
      }

      for (const file of files) {
        if (!file.endsWith('.md')) continue

        const dateMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/)
        if (!dateMatch) continue

        const filePath = path.join(monthDir, file)

        try {
          const fileContent = await readFile(filePath, 'utf-8')
          const { frontmatterText, body } = extractFrontmatter(fileContent)
          const parsedFrontmatter = frontmatterText ? parseFrontmatterBlock(frontmatterText) : null
          const stats = await import('node:fs/promises').then((m) => m.stat(filePath))
          const fm = normalizeJournalFrontmatter(parsedFrontmatter, {
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
          })

          const [, , dd] = dateMatch
          const key = `${month}-${dd}`

          entries[key] = {
            createdAt: fm.createdAt,
            updatedAt: fm.updatedAt,
            weather: fm.weather,
            location: fm.location,
            mood: fm.mood,
            summary: fm.summary,
            tags: [...fm.tags],
            wordCount: countJournalWords(body),
          }

          totalEntries += 1
        } catch {
          // skip unreadable files
        }
      }
    }

    const index: JournalMetaIndex = {
      version: 1,
      year,
      updatedAt: new Date().toISOString(),
      entries,
    }

    await writeJournalMetaIndex(workspacePath, index)
  }

  return { yearCount: yearDirs.length, entryCount: totalEntries }
}
