import type { GenerateDailyInsightsResult } from '../../../src/types/ai'
import type { JournalFrontmatter } from '../../../src/types/journal'
import { generateDailyInsights } from '../ai'
import { runProfileMaintenance } from '../profile'
import { getWorkspaceTags } from '../workspace/libraries'
import { mergeWorkspaceLocationOptions } from '../workspace/libraries'
import { mergeWorkspaceTags } from '../workspace/libraries'
import { mergeWorkspaceWeatherOptions } from '../workspace/libraries'
import { assertValidDate, resolveJournalEntryFilePath } from '../workspace/paths'
import { countJournalWords, writeJournalDocument } from './document'
import { updateJournalMetaEntry } from './meta-index'
import { readJournalEntry } from './service'

export type JournalWriteMode = 'create' | 'append' | 'overwrite'

export interface WriteJournalEntryFullInput {
  workspacePath: string
  date: string
  body: string
  weather: string
  location: string
  mode?: JournalWriteMode
  organize?: boolean
}

export interface WriteJournalEntryFullResult {
  date: string
  filePath: string
  mode: JournalWriteMode
  wordCount: number
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
  addedWeather: string[]
  addedLocations: string[]
  addedTags: string[]
  timelineWorthy: boolean
  organize: {
    status: 'ok' | 'skipped' | 'failed'
    warning?: string
  }
  maintenance: {
    profile: 'triggered' | 'skipped'
  }
}

export async function writeJournalEntryFull(
  input: WriteJournalEntryFullInput,
): Promise<WriteJournalEntryFullResult> {
  const workspacePath = input.workspacePath.trim()
  const mode = input.mode ?? 'create'
  const organize = input.organize ?? true
  const body = input.body.trim()
  const weather = input.weather.trim()
  const location = input.location.trim()

  if (!workspacePath) {
    throw new Error('当前还没有打开的工作区。')
  }

  assertValidDate(input.date)

  if (!body) {
    throw new Error('正文为空，无法写入日记。')
  }

  if (!weather) {
    throw new Error('缺少天气信息，无法写入日记。')
  }

  if (!location) {
    throw new Error('缺少地点信息，无法写入日记。')
  }

  const filePath = resolveJournalEntryFilePath(workspacePath, input.date)
  const currentResult = await readJournalEntry({ workspacePath, date: input.date })

  if (mode === 'create' && currentResult.status === 'ready') {
    throw new Error('当天日记已存在，如需修改请使用 append 或 overwrite 模式。')
  }

  const existing = currentResult.status === 'ready' ? currentResult : null
  const existingFrontmatter = existing?.frontmatter ?? null
  const existingBody = existing?.body ?? ''

  const finalBody =
    mode === 'append' && existingBody.trim()
      ? `${existingBody.trim()}\n\n${body}`
      : body

  const now = new Date().toISOString()
  const baseFrontmatter: JournalFrontmatter = {
    createdAt: existingFrontmatter?.createdAt ?? now,
    updatedAt: now,
    weather,
    location,
    mood: existingFrontmatter?.mood ?? 0,
    summary: existingFrontmatter?.summary ?? '',
    tags: [...(existingFrontmatter?.tags ?? [])],
  }

  await writeJournalDocument(filePath, baseFrontmatter, finalBody)
  await updateJournalMetaEntry(workspacePath, input.date, baseFrontmatter, finalBody)

  const [addedWeather, addedLocations] = await Promise.all([
    mergeWorkspaceWeatherOptions(workspacePath, [weather]),
    mergeWorkspaceLocationOptions(workspacePath, [location]),
  ])

  let finalFrontmatter = baseFrontmatter
  let addedTags: string[] = []
  let timelineWorthy = false
  let organizeStatus: WriteJournalEntryFullResult['organize'] = { status: 'skipped' }
  let maintenance: WriteJournalEntryFullResult['maintenance'] = {
    profile: 'skipped',
  }

  if (organize) {
    try {
      const workspaceTags = await getWorkspaceTags(workspacePath)
      const insights: GenerateDailyInsightsResult = await generateDailyInsights({
        workspacePath,
        date: input.date,
        body: finalBody,
        workspaceTags,
      })

      finalFrontmatter = {
        ...baseFrontmatter,
        mood: insights.mood,
        summary: insights.summary,
        tags: [...insights.tags],
        updatedAt: new Date().toISOString(),
      }
      await writeJournalDocument(filePath, finalFrontmatter, finalBody)
      await updateJournalMetaEntry(workspacePath, input.date, finalFrontmatter, finalBody)
      addedTags = await mergeWorkspaceTags(workspacePath, insights.tags)

      organizeStatus = { status: 'ok' }
      timelineWorthy = insights.timelineWorthy
      maintenance = { profile: 'triggered' }

      // 与应用内"自动整理"行为一致：异步触发，失败只记日志，不影响返回
      void runProfileMaintenance({ workspacePath, date: input.date, body: finalBody })
    } catch (error) {
      const warning = error instanceof Error ? error.message : '自动整理失败。'
      organizeStatus = { status: 'failed', warning }
    }
  }

  return {
    date: input.date,
    filePath,
    mode,
    wordCount: countJournalWords(finalBody),
    weather,
    location,
    mood: finalFrontmatter.mood,
    summary: finalFrontmatter.summary,
    tags: [...finalFrontmatter.tags],
    addedWeather,
    addedLocations,
    addedTags,
    timelineWorthy,
    organize: organizeStatus,
    maintenance,
  }
}
