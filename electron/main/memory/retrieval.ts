import path from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import type { JournalMetaIndex } from '../../../src/types/journal'
import { readJournalDocument } from '../journal/document'
import { readJournalMetaIndex } from '../journal/meta-index'
import {
  getLegacyUserProfilePath,
  getWorkspaceJournalDir,
  getWorkspaceSupplementPath,
  getWorkspaceUserProfileDir,
  resolveJournalEntryFilePath,
} from '../workspace/paths'
import type {
  MemoryBatchReadResult,
  MemoryEntryDocument,
  MemoryGrepMatch,
  MemoryMetaCandidate,
  MemoryUserProfile,
} from './types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_GREP_MATCHES = 50
const MAX_GREP_MATCHES_PER_FILE = 3
const SNIPPET_CONTEXT_CHARS = 60

export function uniqDates(dates: string[]): string[] {
  return [...new Set(dates)]
}

export async function listJournalYears(workspacePath: string): Promise<string[]> {
  try {
    const entries = await readdir(getWorkspaceJournalDir(workspacePath), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

export async function readMetaCandidates(
  workspacePath: string,
  years: string[],
): Promise<MemoryMetaCandidate[]> {
  const candidates: MemoryMetaCandidate[] = []

  for (const year of [...new Set(years)]) {
    const index = await readJournalMetaIndex(workspacePath, year)
    if (!index) {
      continue
    }

    for (const [dayKey, entry] of Object.entries(index.entries)) {
      candidates.push({
        date: `${year}-${dayKey}`,
        weather: entry.weather,
        location: entry.location,
        mood: entry.mood,
        summary: entry.summary,
        tags: [...entry.tags],
        wordCount: entry.wordCount,
      })
    }
  }

  return candidates.sort((a, b) => a.date.localeCompare(b.date))
}

export async function batchReadEntries(
  workspacePath: string,
  dates: string[],
): Promise<MemoryBatchReadResult> {
  const entries: MemoryEntryDocument[] = []
  const skippedDates: string[] = []

  for (const date of uniqDates(dates)) {
    if (!DATE_PATTERN.test(date)) {
      skippedDates.push(date)
      continue
    }

    try {
      const document = await readJournalDocument(resolveJournalEntryFilePath(workspacePath, date))
      entries.push({
        date,
        summary: document.frontmatter.summary,
        body: document.body,
        mood: document.frontmatter.mood,
        tags: [...document.frontmatter.tags],
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        skippedDates.push(date)
        continue
      }

      throw error
    }
  }

  return {
    entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    skippedDates: skippedDates.sort(),
  }
}

function buildGrepSnippet(content: string, hitIndex: number, keywordLength: number) {
  const start = Math.max(0, hitIndex - SNIPPET_CONTEXT_CHARS)
  const end = Math.min(content.length, hitIndex + keywordLength + SNIPPET_CONTEXT_CHARS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

export async function grepDiaryText(
  workspacePath: string,
  keyword: string,
): Promise<MemoryGrepMatch[]> {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  if (!normalizedKeyword) {
    return []
  }

  const matches: MemoryGrepMatch[] = []
  const years = await listJournalYears(workspacePath)

  outer: for (const year of years) {
    const yearDir = path.join(getWorkspaceJournalDir(workspacePath), year)

    let monthEntries
    try {
      monthEntries = await readdir(yearDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const monthEntry of monthEntries) {
      if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) {
        continue
      }

      const monthDir = path.join(yearDir, monthEntry.name)
      let files
      try {
        files = await readdir(monthDir)
      } catch {
        continue
      }

      for (const file of files.sort()) {
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
        if (!dateMatch) {
          continue
        }

        // 复用文档解析，只在 body 正文内匹配，避免命中 frontmatter 元信息
        let document
        try {
          document = await readJournalDocument(path.join(monthDir, file))
        } catch {
          continue
        }

        const body = document.body
        const lowerBody = body.toLocaleLowerCase()
        let fromIndex = 0
        let fileMatchCount = 0

        while (matches.length < MAX_GREP_MATCHES && fileMatchCount < MAX_GREP_MATCHES_PER_FILE) {
          const hitIndex = lowerBody.indexOf(normalizedKeyword, fromIndex)
          if (hitIndex === -1) {
            break
          }

          matches.push({
            date: dateMatch[1],
            summary: document.frontmatter.summary,
            snippet: buildGrepSnippet(body, hitIndex, normalizedKeyword.length),
          })
          fileMatchCount += 1
          fromIndex = hitIndex + normalizedKeyword.length
        }

        if (matches.length >= MAX_GREP_MATCHES) {
          break outer
        }
      }
    }
  }

  return matches
}

export async function getMetaIndex(
  workspacePath: string,
  year: string,
): Promise<JournalMetaIndex | null> {
  return readJournalMetaIndex(workspacePath, year)
}

export async function getUserProfile(workspacePath: string): Promise<MemoryUserProfile> {
  const profileDir = getWorkspaceUserProfileDir(workspacePath)
  const supplement = await readSupplement(workspacePath)

  let profileYears: string[] = []
  try {
    profileYears = (await readdir(profileDir))
      .map((name) => name.match(/^user-profile-(\d{4})\.md$/)?.[1])
      .filter((year): year is string => Boolean(year))
      .sort()
  } catch {
    // 目录不存在时按无画像处理，继续尝试 legacy 文件
  }

  const latestYear = profileYears[profileYears.length - 1]
  if (latestYear) {
    try {
      const content = await readFile(
        path.join(profileDir, `user-profile-${latestYear}.md`),
        'utf-8',
      )
      return { year: latestYear, content, supplement }
    } catch {
      // 读取失败时继续尝试 legacy 文件
    }
  }

  try {
    const content = await readFile(getLegacyUserProfilePath(workspacePath), 'utf-8')
    return { year: null, content, supplement }
  } catch {
    return { year: null, content: '', supplement }
  }
}

async function readSupplement(workspacePath: string): Promise<string> {
  try {
    return await readFile(getWorkspaceSupplementPath(workspacePath), 'utf-8')
  } catch {
    return ''
  }
}
