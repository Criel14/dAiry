import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../constants'
import type { TimelineYearData } from '../../../src/types/timeline'
import { readTimelineYear, writeTimelineYear } from '../timeline/service'
import {
  rebuildTimelineYear,
  cancelTimelineRebuild,
  addTimelineDayEvent,
} from '../timeline/ai'

let activeRebuildYear: number | null = null

export function registerTimelineIpcHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.getTimeline,
    (_event, input: { workspacePath: string; year: number }) => {
      return readTimelineYear(input.workspacePath, input.year)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.rebuildTimeline,
    async (event, input: { workspacePath: string; year: number }) => {
      const year = Number(input?.year)
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error('年份无效，请选择有效的年份后重试。')
      }

      activeRebuildYear = year

      try {
        const result = await rebuildTimelineYear(workspacePathOrThrow(input.workspacePath), year, (
          progress,
        ) => {
          event.sender.send(IPC_CHANNELS.timelineRebuildProgress, progress)
        })

        if (result === null) {
          // cancelled
          return { skipped: false }
        }

        if (result.diaryBatchCount === 0) {
          console.warn(`[timeline] 未找到 ${year} 年的日记，跳过落盘，避免覆盖已有数据。`)
          return { skipped: true }
        }

        const data: TimelineYearData = {
          year,
          version: 2,
          generatedAt: new Date().toISOString(),
          events: result.events,
        }

        writeTimelineYear(input.workspacePath, data)
        console.log(`[timeline] ${year} 年时间轴重建完成，共 ${result.events.length} 个事件。`)
        return { skipped: false }
      } catch (err) {
        console.error(`[timeline] ${year} 年时间轴重建失败：`, err)
        throw err
      } finally {
        if (activeRebuildYear === year) {
          activeRebuildYear = null
        }
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.cancelTimelineRebuild, () => {
    if (activeRebuildYear !== null) {
      cancelTimelineRebuild(activeRebuildYear)
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.addTimelineDayEvent,
    async (_event, input: { workspacePath: string; date: string }) => {
      if (typeof input?.workspacePath !== 'string' || !input.workspacePath.trim()) {
        throw new Error('工作区路径无效。')
      }

      return addTimelineDayEvent(input.workspacePath, input.date)
    },
  )
}

function workspacePathOrThrow(workspacePath: unknown): string {
  if (typeof workspacePath !== 'string' || !workspacePath.trim()) {
    throw new Error('工作区路径无效。')
  }
  return workspacePath
}
