import { mkdir, readFile, writeFile } from 'node:fs/promises'
import dayjs from 'dayjs'
import type { AiSettings, RecentDaySummary } from '../../../src/types/ai'
import { normalizeAiSettings, readAppConfig } from '../app-config'
import { readAiApiKey } from '../secrets'
import { createAiChatClient, getRecentDailySummaries, loadPrompt } from '../ai'
import type { AiChatClient } from '../ai'
import { readJournalDocument } from '../journal/document'
import {
  getWorkspaceMetadataDir,
  getWorkspaceUserProfilePath,
  resolveJournalEntryFilePath,
} from '../workspace/paths'
import { readWorkspaceConfig, updateWorkspaceConfig } from '../workspace/config'

const PROFILE_AI_TEMPERATURE = 0.3
const MAX_ENTRY_BODY_LENGTH = 2200

interface ProfileMaintenanceInput {
  workspacePath: string
  date: string
  body: string
}

interface ProfileRangeEntry {
  date: string
  mood: number
  summary: string
  body: string
}

export async function readUserProfile(workspacePath: string): Promise<string> {
  try {
    return await readFile(getWorkspaceUserProfilePath(workspacePath), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

export async function writeUserProfile(workspacePath: string, content: string): Promise<void> {
  await mkdir(getWorkspaceMetadataDir(workspacePath), { recursive: true })
  await writeFile(getWorkspaceUserProfilePath(workspacePath), content, 'utf-8')
}

// AI 可能用代码围栏包裹整份画像，写盘前剥掉
function normalizeProfileMarkdown(responseText: string) {
  const trimmedText = responseText.trim()
  const fencedMatch = trimmedText.match(/^```[A-Za-z]*\r?\n([\s\S]*?)\r?\n```$/)
  return (fencedMatch ? fencedMatch[1] : trimmedText).trim()
}

function truncateEntryBody(body: string) {
  const normalizedBody = body.trim()
  if (normalizedBody.length <= MAX_ENTRY_BODY_LENGTH) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, MAX_ENTRY_BODY_LENGTH)}...`
}

function buildRecentSummariesBlock(recentSummaries: RecentDaySummary[]) {
  if (recentSummaries.length === 0) {
    return '前几天的日记摘要：（无）'
  }

  const summaryLines = recentSummaries.map((item) => {
    const parts = [`摘要: ${item.summary || '（无）'}`, `心情: ${item.mood}`]

    if (item.tags.length > 0) {
      parts.push(`标签: ${item.tags.join('、')}`)
    }

    return `- ${item.date}: ${parts.join('  |  ')}`
  })

  return ['前几天的日记摘要：', ...summaryLines].join('\n')
}

function buildDailyUpdatePrompt(input: {
  date: string
  body: string
  recentSummaries: RecentDaySummary[]
  currentProfile: string
}) {
  return [
    `业务日期：${input.date}`,
    buildRecentSummariesBlock(input.recentSummaries),
    `当前用户画像：\n${input.currentProfile.trim() || '（当前画像为空，请创建初始画像）'}`,
    `当日日记正文：\n${truncateEntryBody(input.body)}`,
  ].join('\n\n')
}

function buildFullRefreshPrompt(input: {
  startDate: string
  endDate: string
  currentProfile: string
  entries: ProfileRangeEntry[]
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
    `整理周期：${input.startDate} ~ ${input.endDate}`,
    `当前用户画像（作为参考，可能会被大幅修改）：\n${input.currentProfile.trim() || '（当前画像为空）'}`,
    `区间日记：\n${entryBlocks.join('\n')}`,
  ].join('\n\n')
}

async function collectRangeEntries(
  workspacePath: string,
  startDate: string,
  endDate: string,
  todayBody: string,
): Promise<ProfileRangeEntry[]> {
  const entries: ProfileRangeEntry[] = []
  const totalDays = dayjs(endDate).diff(dayjs(startDate), 'day')

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const date = dayjs(startDate).add(offset, 'day').format('YYYY-MM-DD')

    try {
      const document = await readJournalDocument(resolveJournalEntryFilePath(workspacePath, date))
      // 当天正文可能还没保存到磁盘，优先使用编辑器中的内存内容
      const body = date === endDate && todayBody.trim() ? todayBody : document.body

      entries.push({
        date,
        mood: document.frontmatter.mood,
        summary: document.frontmatter.summary,
        body: truncateEntryBody(body),
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (date === endDate && todayBody.trim()) {
          entries.push({
            date,
            mood: 0,
            summary: '',
            body: truncateEntryBody(todayBody),
          })
        }

        continue
      }

      throw error
    }
  }

  return entries.filter((entry) => entry.body || entry.summary.trim())
}

async function createProfileAiClient(settings: AiSettings): Promise<AiChatClient | null> {
  if (!settings.baseURL || !settings.model) {
    return null
  }

  const apiKey = await readAiApiKey(settings.providerType)
  if (!apiKey) {
    return null
  }

  return createAiChatClient(settings, apiKey)
}

export async function updateUserProfileDaily(input: {
  client: AiChatClient
  workspacePath: string
  date: string
  body: string
  recentSummaries: RecentDaySummary[]
}): Promise<void> {
  const [systemPrompt, currentProfile] = await Promise.all([
    loadPrompt('profileDailyUpdateSystem'),
    readUserProfile(input.workspacePath),
  ])

  const responseText = await input.client.completeText({
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildDailyUpdatePrompt({
          date: input.date,
          body: input.body,
          recentSummaries: input.recentSummaries,
          currentProfile,
        }),
      },
    ],
    temperature: PROFILE_AI_TEMPERATURE,
  })

  const nextProfile = normalizeProfileMarkdown(responseText)
  if (!nextProfile) {
    throw new Error('AI 返回的画像内容为空。')
  }

  await writeUserProfile(input.workspacePath, nextProfile)
}

export async function refreshUserProfileFull(input: {
  client: AiChatClient
  workspacePath: string
  endDate: string
  intervalDays: number
  todayBody: string
}): Promise<void> {
  const startDate = dayjs(input.endDate)
    .subtract(input.intervalDays - 1, 'day')
    .format('YYYY-MM-DD')

  const [systemPrompt, currentProfile, entries] = await Promise.all([
    loadPrompt('profileFullRefreshSystem'),
    readUserProfile(input.workspacePath),
    collectRangeEntries(input.workspacePath, startDate, input.endDate, input.todayBody),
  ])

  if (entries.length === 0) {
    return
  }

  const responseText = await input.client.completeText({
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildFullRefreshPrompt({
          startDate,
          endDate: input.endDate,
          currentProfile,
          entries,
        }),
      },
    ],
    temperature: PROFILE_AI_TEMPERATURE,
  })

  const nextProfile = normalizeProfileMarkdown(responseText)
  if (!nextProfile) {
    throw new Error('AI 返回的画像内容为空。')
  }

  await writeUserProfile(input.workspacePath, nextProfile)
  await updateWorkspaceConfig(input.workspacePath, {
    lastProfileRefresh: new Date().toISOString(),
  })
}

export async function shouldRunFullRefresh(
  workspacePath: string,
  date: string,
  intervalDays: number,
): Promise<boolean> {
  const workspaceConfig = await readWorkspaceConfig(workspacePath)
  const lastProfileRefresh = workspaceConfig.lastProfileRefresh

  if (!lastProfileRefresh || !lastProfileRefresh.trim()) {
    return true
  }

  const lastRefreshDay = dayjs(lastProfileRefresh)
  if (!lastRefreshDay.isValid()) {
    return true
  }

  return dayjs(date).startOf('day').diff(lastRefreshDay.startOf('day'), 'day') >= intervalDays
}

// 自动整理成功后的画像维护总入口：任何失败只告警，不向上抛
export async function runProfileMaintenance(input: ProfileMaintenanceInput): Promise<void> {
  try {
    if (!input.workspacePath.trim() || !input.body.trim()) {
      return
    }

    const config = await readAppConfig()
    const settings = normalizeAiSettings(config.ai)
    const client = await createProfileAiClient(settings)

    if (!client) {
      return
    }

    const recentSummaries = await getRecentDailySummaries(
      input.workspacePath,
      input.date,
      settings.dailyContextDays,
    )

    try {
      await updateUserProfileDaily({
        client,
        workspacePath: input.workspacePath,
        date: input.date,
        body: input.body,
        recentSummaries,
      })
    } catch (error) {
      console.warn('[profile] 画像日更失败：', error)
    }

    try {
      const needsFullRefresh = await shouldRunFullRefresh(
        input.workspacePath,
        input.date,
        settings.profileRefreshIntervalDays,
      )

      if (needsFullRefresh) {
        await refreshUserProfileFull({
          client,
          workspacePath: input.workspacePath,
          endDate: input.date,
          intervalDays: settings.profileRefreshIntervalDays,
          todayBody: input.body,
        })
      }
    } catch (error) {
      console.warn('[profile] 画像周期刷新失败：', error)
    }
  } catch (error) {
    console.warn('[profile] 画像维护流程失败：', error)
  }
}
