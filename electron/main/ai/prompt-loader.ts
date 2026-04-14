import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const PROMPT_FILE_MAP = {
  dailyOrganizeSystem: new URL('./prompts/daily-organize.system.md', import.meta.url),
  rangeReportSummaryFocusSystem: new URL('./prompts/range-report-summary-focus.system.md', import.meta.url),
  rangeReportSummarySystem: new URL('./prompts/range-report-summary.system.md', import.meta.url),
} as const

const promptCache = new Map<keyof typeof PROMPT_FILE_MAP, string>()

export async function loadPrompt(name: keyof typeof PROMPT_FILE_MAP) {
  const cachedPrompt = promptCache.get(name)
  if (cachedPrompt) {
    return cachedPrompt
  }

  const promptUrl = PROMPT_FILE_MAP[name]
  let promptText = ''

  if (promptUrl.protocol === 'file:') {
    promptText = await readFile(fileURLToPath(promptUrl), 'utf-8')
  } else if (promptUrl.protocol === 'data:') {
    const response = await fetch(promptUrl)
    promptText = await response.text()
  } else {
    throw new Error(`暂不支持读取 ${promptUrl.protocol} 协议的提示词文件。`)
  }

  promptCache.set(name, promptText)
  return promptText
}
