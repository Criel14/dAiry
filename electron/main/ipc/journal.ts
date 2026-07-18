import { ipcMain } from 'electron'
import type {
  GenerateDailyInsightsInput,
} from '../../../src/types/ai'
import type {
  JournalEntryBodySaveInput,
  JournalEntryMetadataSaveInput,
  JournalEntryQuery,
  JournalMonthActivityQuery,
} from '../../../src/types/journal'
import { generateDailyInsights } from '../ai'
import { runProfileMaintenance } from '../profile'
import { IPC_CHANNELS } from '../constants'
import {
  createJournalEntry,
  getJournalMonthActivity,
  readJournalEntry,
  saveJournalEntryBody,
  saveJournalEntryMetadata,
} from '../journal/service'

export function registerJournalIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.readJournalEntry, (_event, input: JournalEntryQuery) => {
    return readJournalEntry(input)
  })

  ipcMain.handle(IPC_CHANNELS.createJournalEntry, (_event, input: JournalEntryQuery) => {
    return createJournalEntry(input)
  })

  ipcMain.handle(IPC_CHANNELS.saveJournalEntryBody, (_event, input: JournalEntryBodySaveInput) => {
    return saveJournalEntryBody(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.saveJournalEntryMetadata,
    (_event, input: JournalEntryMetadataSaveInput) => {
      return saveJournalEntryMetadata(input)
    },
  )

  ipcMain.handle(IPC_CHANNELS.getJournalMonthActivity, (_event, input: JournalMonthActivityQuery) => {
    return getJournalMonthActivity(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.generateDailyInsights,
    async (_event, input: GenerateDailyInsightsInput) => {
      const result = await generateDailyInsights(input)

      // 画像维护异步执行，不阻塞日总结返回，失败也不影响主流程
      void runProfileMaintenance({
        workspacePath: input.workspacePath,
        date: input.date,
        body: input.body,
      })

      return result
    },
  )
}
