import path from 'node:path'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import type {
  JournalDayActivity,
  JournalEntryBodySaveInput,
  JournalEntryMetadataSaveInput,
  JournalEntryQuery,
  JournalEntryReadResult,
  JournalEntryWriteResult,
  JournalMonthActivityQuery,
  JournalMonthActivityResult,
} from '../../../src/types/journal'
import {
  countJournalWords,
  createDefaultFrontmatter,
  normalizeJournalMetadata,
  readJournalDocument,
  readJournalDocumentOrDefault,
  serializeJournalDocument,
  writeJournalDocument,
} from './document'
import {
  mergeWorkspaceLocationOptions,
  mergeWorkspaceTags,
  mergeWorkspaceWeatherOptions,
} from '../workspace/libraries'
import {
  assertValidMonth,
  getWorkspaceJournalDir,
  resolveJournalEntryFilePath,
  resolveJournalEntryPath,
} from '../workspace/paths'

function getDaysInMonth(monthText: string) {
  assertValidMonth(monthText)

  const [yearText, monthValueText] = monthText.split('-')
  const year = Number(yearText)
  const monthValue = Number(monthValueText)

  return new Date(year, monthValue, 0).getDate()
}

export async function readJournalEntry(input: JournalEntryQuery): Promise<JournalEntryReadResult> {
  const filePath = resolveJournalEntryPath(input)

  try {
    const document = await readJournalDocument(filePath)
    return {
      status: 'ready',
      filePath,
      frontmatter: document.frontmatter,
      body: document.body,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        status: 'missing',
        filePath,
        frontmatter: null,
        body: null,
      }
    }

    throw error
  }
}

export async function createJournalEntry(
  input: JournalEntryQuery,
): Promise<JournalEntryReadResult> {
  const filePath = resolveJournalEntryPath(input)
  await mkdir(path.dirname(filePath), { recursive: true })
  const frontmatter = createDefaultFrontmatter()

  try {
    await writeFile(filePath, serializeJournalDocument(frontmatter, ''), {
      encoding: 'utf-8',
      flag: 'wx',
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }

  return readJournalEntry(input)
}

export async function saveJournalEntryBody(
  input: JournalEntryBodySaveInput,
): Promise<JournalEntryWriteResult> {
  const filePath = resolveJournalEntryPath(input)
  const currentDocument = await readJournalDocumentOrDefault(filePath)
  const savedAt = new Date().toISOString()

  await writeJournalDocument(
    filePath,
    {
      ...currentDocument.frontmatter,
      updatedAt: savedAt,
    },
    input.body,
  )

  return {
    filePath,
    savedAt,
  }
}

export async function saveJournalEntryMetadata(
  input: JournalEntryMetadataSaveInput,
): Promise<JournalEntryWriteResult> {
  const filePath = resolveJournalEntryPath(input)
  const currentDocument = await readJournalDocumentOrDefault(filePath)
  const savedAt = new Date().toISOString()
  const normalizedMetadata = normalizeJournalMetadata(input.metadata)

  await writeJournalDocument(
    filePath,
    {
      ...currentDocument.frontmatter,
      ...normalizedMetadata,
      updatedAt: savedAt,
    },
    currentDocument.body,
  )

  await mergeWorkspaceTags(input.workspacePath, normalizedMetadata.tags)
  await mergeWorkspaceWeatherOptions(
    input.workspacePath,
    normalizedMetadata.weather ? [normalizedMetadata.weather] : [],
  )
  await mergeWorkspaceLocationOptions(
    input.workspacePath,
    normalizedMetadata.location ? [normalizedMetadata.location] : [],
  )

  return {
    filePath,
    savedAt,
  }
}

export async function getJournalMonthActivity(
  input: JournalMonthActivityQuery,
): Promise<JournalMonthActivityResult> {
  const { workspacePath, month } = input
  const totalDays = getDaysInMonth(month)
  const [year, monthValue] = month.split('-')

  const days = await Promise.all(
    Array.from({ length: totalDays }, async (_value, index): Promise<JournalDayActivity> => {
      const day = String(index + 1).padStart(2, '0')
      const date = `${year}-${monthValue}-${day}`
      const filePath = resolveJournalEntryFilePath(workspacePath, date)

      try {
        const document = await readJournalDocument(filePath)
        return {
          date,
          hasEntry: true,
          wordCount: countJournalWords(document.body),
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            date,
            hasEntry: false,
            wordCount: 0,
          }
        }

        throw error
      }
    }),
  )

  return {
    month,
    days,
  }
}

export async function getJournalYearsWithEntries(workspacePath: string): Promise<string[]> {
  const yearPattern = /^\d{4}$/
  const journalDir = getWorkspaceJournalDir(workspacePath)

  let yearDirs: string[]
  try {
    const entries = await readdir(journalDir, { withFileTypes: true })
    yearDirs = entries
      .filter((entry) => entry.isDirectory() && yearPattern.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }

  const results = await Promise.all(
    yearDirs.map(async (year) => {
      const monthDir = path.join(journalDir, year)
      let months: string[]
      try {
        months = (await readdir(monthDir, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      } catch {
        return null
      }

      for (const month of months) {
        const dayDir = path.join(monthDir, month)
        try {
          const files = await readdir(dayDir)
          if (files.some((f) => f.endsWith('.md'))) {
            return year
          }
        } catch {
          // skip inaccessible month dirs
        }
      }

      return null
    }),
  )

  return results.filter((y): y is string => y !== null)
}
