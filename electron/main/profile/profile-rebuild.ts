import path from 'node:path'
import { readdir } from 'node:fs/promises'
import type {
  RebuildUserProfileInput,
  RebuildUserProfileResult,
  UserProfileRebuildProgress,
} from '../../../src/types/ai'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { loadPrompt } from '../ai'
import { readJournalDocument } from '../journal/document'
import { getWorkspaceJournalDir, resolveJournalEntryFilePath } from '../workspace/paths'
import { updateWorkspaceConfig } from '../workspace/config'
import {
  PROFILE_AI_TEMPERATURE,
  createProfileAiClient,
  isProfileRebuildRunning,
  normalizeProfileMarkdown,
  setProfileRebuildRunning,
  writeUserProfile,
} from './profile-service'

const MONTH_BODY_BUDGET = 60000
const MAX_ENTRY_BODY_LENGTH = 2200

interface RebuildMonthEntry {
  date: string
  mood: number
  summary: string
  body: string
}

let isCancelRequested = false

export function cancelUserProfileRebuild() {
  if (isProfileRebuildRunning()) {
    isCancelRequested = true
  }
}

function truncateBody(body: string, maxLength: number) {
  const normalizedBody = body.trim()
  if (normalizedBody.length <= maxLength) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, maxLength)}...`
}

async function scanJournalMonths(workspacePath: string): Promise<Map<string, string[]>> {
  const journalDir = getWorkspaceJournalDir(workspacePath)
  const monthDates = new Map<string, string[]>()

  let yearEntries
  try {
    yearEntries = await readdir(journalDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return monthDates
    }

    throw error
  }

  for (const yearEntry of yearEntries) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) {
      continue
    }

    const monthEntries = await readdir(path.join(journalDir, yearEntry.name), {
      withFileTypes: true,
    })

    for (const monthEntry of monthEntries) {
      if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) {
        continue
      }

      const month = `${yearEntry.name}-${monthEntry.name}`
      const fileEntries = await readdir(path.join(journalDir, yearEntry.name, monthEntry.name), {
        withFileTypes: true,
      })
      const dates: string[] = []

      for (const fileEntry of fileEntries) {
        const fileMatch = fileEntry.isFile()
          ? fileEntry.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
          : null

        if (!fileMatch || !fileMatch[1].startsWith(month)) {
          continue
        }

        dates.push(fileMatch[1])
      }

      if (dates.length > 0) {
        monthDates.set(month, dates.sort())
      }
    }
  }

  return monthDates
}

async function collectMonthEntries(
  workspacePath: string,
  dates: string[],
): Promise<RebuildMonthEntry[]> {
  // 单月正文总量控制在预算内，篇数越多单篇截断越短
  const bodyLimit = Math.min(MAX_ENTRY_BODY_LENGTH, Math.floor(MONTH_BODY_BUDGET / dates.length))
  const entries: RebuildMonthEntry[] = []

  for (const date of dates) {
    try {
      const document = await readJournalDocument(resolveJournalEntryFilePath(workspacePath, date))

      entries.push({
        date,
        mood: document.frontmatter.mood,
        summary: document.frontmatter.summary,
        body: truncateBody(document.body, bodyLimit),
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }

      throw error
    }
  }

  return entries.filter((entry) => entry.body || entry.summary.trim())
}

function buildRebuildPrompt(input: {
  month: string
  index: number
  total: number
  profile: string
  entries: RebuildMonthEntry[]
}) {
  const entryBlocks = input.entries.map((entry) =>
    [
      '---',
      `日期: ${entry.date}`,
      `心情: ${entry.mood}`,
      `摘要: ${entry.summary || '（无）'}`,
      `正文:\n${entry.body || '（无）'}`,
    ].join('\n'),
  )

  return [
    `整理月份：${input.month}（第 ${input.index}/${input.total} 个月）`,
    `截至上月的用户画像：\n${input.profile.trim() || '（这是第一个月，画像从空开始）'}`,
    `本月日记：\n${entryBlocks.join('\n')}`,
  ].join('\n\n')
}

export async function rebuildUserProfile(
  input: RebuildUserProfileInput,
  onProgress?: (progress: UserProfileRebuildProgress) => void,
): Promise<RebuildUserProfileResult> {
  if (!input.workspacePath.trim()) {
    throw new Error('当前还没有可用的工作区。')
  }

  if (isProfileRebuildRunning()) {
    throw new Error('画像整理已在进行中。')
  }

  const config = await readAppConfig()
  const settings = normalizeAiSettings(config.ai)
  const client = await createProfileAiClient(settings)

  if (!client) {
    throw new Error('请先在设置页完成大模型配置和 API Key 保存。')
  }

  isCancelRequested = false
  setProfileRebuildRunning(true)

  const monthDates = await scanJournalMonths(input.workspacePath)
  const months = [...monthDates.keys()].sort()

  if (months.length === 0) {
    throw new Error('当前工作区没有可用于整理的日记。')
  }

  try {
    const systemPrompt = await loadPrompt('profileRebuildSystem')
    let profile = ''
    let processedMonths = 0

    for (const [monthIndex, month] of months.entries()) {
      if (isCancelRequested) {
        return { status: 'cancelled', processedMonths, totalMonths: months.length }
      }

      onProgress?.({ month, index: monthIndex + 1, total: months.length })

      const entries = await collectMonthEntries(input.workspacePath, monthDates.get(month) ?? [])
      if (entries.length === 0) {
        processedMonths += 1
        continue
      }

      let responseText = ''
      let aiSucceeded = false
      try {
        const userContent = buildRebuildPrompt({
          month,
          index: monthIndex + 1,
          total: months.length,
          profile,
          entries,
        })

        let lastError: unknown
        for (let attempt = 0; attempt < 2; attempt += 1) {
          lastError = null

          try {
            responseText = await client.completeText({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
              ],
              temperature: PROFILE_AI_TEMPERATURE,
            })
            aiSucceeded = true
            break
          } catch (error) {
            lastError = error
          }

          if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }

        if (!aiSucceeded) {
          throw lastError instanceof Error
            ? lastError
            : new Error('未知错误')
        }
      } catch (error) {
        throw new Error(
          `整理 ${month} 失败：${error instanceof Error ? error.message : '未知错误'}`,
        )
      }

      const nextProfile = normalizeProfileMarkdown(responseText)
      if (!nextProfile) {
        throw new Error(`整理 ${month} 失败：AI 返回的画像内容为空。`)
      }

      profile = nextProfile
      processedMonths += 1
    }

    // 最后一轮调用返回后才收到取消请求的情况
    if (isCancelRequested) {
      return { status: 'cancelled', processedMonths, totalMonths: months.length }
    }

    if (!profile) {
      throw new Error('整理结束，但没有生成任何画像内容。')
    }

    await writeUserProfile(input.workspacePath, profile)
    await updateWorkspaceConfig(input.workspacePath, {
      lastProfileRefresh: new Date().toISOString(),
    })

    return { status: 'completed', processedMonths, totalMonths: months.length }
  } finally {
    setProfileRebuildRunning(false)
    isCancelRequested = false
  }
}
