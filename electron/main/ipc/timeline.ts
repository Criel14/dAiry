import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../constants'
import type { TimelineYearData } from '../../../src/types/timeline'
import { readTimelineYear, writeTimelineYear } from '../timeline/service'
import { rebuildTimelineYear, cancelTimelineRebuild } from '../timeline/ai'

export function registerTimelineIpcHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.getTimeline,
    (_event, input: { workspacePath: string; year: number }) => {
      return readTimelineYear(input.workspacePath, input.year)
    },
  )

  ipcMain.handle(IPC_CHANNELS.rebuildTimeline, async (event, workspacePath: string) => {
    const now = new Date()
    const year = now.getFullYear()

    const events = await rebuildTimelineYear(workspacePath, year, (progress) => {
      event.sender.send(IPC_CHANNELS.timelineRebuildProgress, progress)
    })

    if (events === null) {
      // cancelled
      return
    }

    const data: TimelineYearData = {
      year,
      version: 1,
      generatedAt: new Date().toISOString(),
      events,
    }

    writeTimelineYear(workspacePath, data)
  })

  ipcMain.handle(IPC_CHANNELS.cancelTimelineRebuild, () => {
    const now = new Date()
    cancelTimelineRebuild(now.getFullYear())
  })
}
