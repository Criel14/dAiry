import { dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import type {
  AppBootstrap,
  DayStartHourPreferenceInput,
  ExportRangeReportInput,
  FrontmatterVisibilityInput,
  GenerateDailyInsightsInput,
  GenerateRangeReportInput,
  JournalEntryBodySaveInput,
  JournalEntryMetadataSaveInput,
  JournalEntryQuery,
  JournalHeatmapPreferenceInput,
  OpenExternalLinkInput,
  JournalMonthActivityQuery,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
  ReportQuery,
  SaveAiApiKeyInput,
  SaveAiSettingsInput,
  WindowDirtyStateInput,
  WindowZoomPreferenceInput,
  WorkspaceSelectionResult,
  WorkspaceStringListInput,
} from '../../src/types/dairy'
import {
  buildWorkspaceConfig,
  readAppConfig,
  setDayStartHour,
  setFrontmatterVisibility,
  setJournalHeatmapEnabled,
  writeAppConfig,
} from './app-config'
import { getAiSettingsStatus, saveAiSettings } from './ai-config'
import { saveAiApiKey } from './ai-secrets'
import { generateDailyInsights } from './ai'
import { IPC_CHANNELS } from './constants'
import {
  createJournalEntry,
  getJournalMonthActivity,
  readJournalEntry,
  saveJournalEntryBody,
  saveJournalEntryMetadata,
} from './journal-service'
import { generateRangeReport, getRangeReport, listRangeReports } from './report-service'
import {
  exportRangeReportPng,
  getReportExportPayload,
  notifyReportExportReady,
} from './report-export-service'
import {
  getMainWindow,
  openMainWindowDevTools,
  setWindowDirtyState,
  updateWindowZoomFactor,
} from './window'
import {
  getWorkspaceLocationOptions,
  getWorkspaceTags,
  getWorkspaceWeatherOptions,
  setWorkspaceLocationOptions,
  setWorkspaceTags,
  setWorkspaceWeatherOptions,
} from './workspace-libraries'

export function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async (): Promise<AppBootstrap> => {
    const config = await readAppConfig()
    return { config }
  })

  ipcMain.handle(IPC_CHANNELS.getAiSettingsStatus, () => {
    return getAiSettingsStatus()
  })

  ipcMain.handle(IPC_CHANNELS.setWindowZoomFactor, (_event, input: WindowZoomPreferenceInput) => {
    return updateWindowZoomFactor(input.zoomFactor)
  })

  ipcMain.handle(IPC_CHANNELS.saveAiSettings, (_event, input: SaveAiSettingsInput) => {
    return saveAiSettings(input)
  })

  ipcMain.handle(IPC_CHANNELS.saveAiApiKey, (_event, input: SaveAiApiKeyInput) => {
    return saveAiApiKey(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.setJournalHeatmapEnabled,
    (_event, input: JournalHeatmapPreferenceInput) => {
      return setJournalHeatmapEnabled(input)
    },
  )

  ipcMain.handle(IPC_CHANNELS.setDayStartHour, (_event, input: DayStartHourPreferenceInput) => {
    return setDayStartHour(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.setFrontmatterVisibility,
    (_event, input: FrontmatterVisibilityInput) => {
      return setFrontmatterVisibility(input)
    },
  )

  ipcMain.handle(IPC_CHANNELS.setWindowDirtyState, (_event, input: WindowDirtyStateInput) => {
    setWindowDirtyState(input.isDirty)
  })

  ipcMain.handle(IPC_CHANNELS.openExternalLink, async (_event, input: OpenExternalLinkInput) => {
    const url = input.url.trim()

    if (!/^https:\/\/.+/i.test(url) && !/^mailto:.+/i.test(url)) {
      throw new Error('暂不支持打开这个地址。')
    }

    await shell.openExternal(url)
  })

  ipcMain.handle(IPC_CHANNELS.openDevTools, () => {
    openMainWindowDevTools()
  })

  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async (): Promise<WorkspaceSelectionResult> => {
    const currentConfig = await readAppConfig()
    const dialogOptions: OpenDialogOptions = {
      title: '选择日记目录',
      buttonLabel: '选择这个目录',
      properties: ['openDirectory'],
    }
    const win = getMainWindow()
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
        workspacePath: null,
        config: currentConfig,
      }
    }

    const workspacePath = result.filePaths[0]
    const nextConfig = buildWorkspaceConfig(workspacePath, currentConfig)
    await writeAppConfig(nextConfig)

    return {
      canceled: false,
      workspacePath,
      config: nextConfig,
    }
  })

  ipcMain.handle(IPC_CHANNELS.getWorkspaceTags, (_event, workspacePath: string) => {
    return getWorkspaceTags(workspacePath)
  })

  ipcMain.handle(IPC_CHANNELS.setWorkspaceTags, (_event, input: WorkspaceStringListInput) => {
    return setWorkspaceTags(input)
  })

  ipcMain.handle(IPC_CHANNELS.getWorkspaceWeatherOptions, (_event, workspacePath: string) => {
    return getWorkspaceWeatherOptions(workspacePath)
  })

  ipcMain.handle(
    IPC_CHANNELS.setWorkspaceWeatherOptions,
    (_event, input: WorkspaceStringListInput) => {
      return setWorkspaceWeatherOptions(input)
    },
  )

  ipcMain.handle(IPC_CHANNELS.getWorkspaceLocationOptions, (_event, workspacePath: string) => {
    return getWorkspaceLocationOptions(workspacePath)
  })

  ipcMain.handle(
    IPC_CHANNELS.setWorkspaceLocationOptions,
    (_event, input: WorkspaceStringListInput) => {
      return setWorkspaceLocationOptions(input)
    },
  )

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

  ipcMain.handle(IPC_CHANNELS.generateDailyInsights, (_event, input: GenerateDailyInsightsInput) => {
    return generateDailyInsights(input)
  })

  ipcMain.handle(IPC_CHANNELS.generateRangeReport, (_event, input: GenerateRangeReportInput) => {
    return generateRangeReport(input)
  })

  ipcMain.handle(IPC_CHANNELS.getRangeReport, (_event, input: ReportQuery) => {
    return getRangeReport(input)
  })

  ipcMain.handle(IPC_CHANNELS.listRangeReports, (_event, workspacePath: string) => {
    return listRangeReports(workspacePath)
  })

  ipcMain.handle(IPC_CHANNELS.exportRangeReportPng, (_event, input: ExportRangeReportInput) => {
    return exportRangeReportPng(input)
  })

  ipcMain.handle(IPC_CHANNELS.getReportExportPayload, (_event, input: ReportExportPayloadQuery) => {
    return getReportExportPayload(input)
  })

  ipcMain.handle(IPC_CHANNELS.notifyReportExportReady, (_event, input: ReportExportReadyInput) => {
    return notifyReportExportReady(input)
  })
}
