import { ipcMain } from 'electron'
import type {
  ExportRangeReportInput,
  GenerateRangeReportInput,
  ReportExportErrorInput,
  ReportExportPayloadQuery,
  ReportExportReadyInput,
  ReportQuery,
} from '../../../src/types/report'
import { IPC_CHANNELS } from '../constants'
import { generateRangeReport, getRangeReport, listRangeReports } from '../report'
import {
  exportRangeReportPng,
  getReportExportPayload,
  notifyReportExportError,
  notifyReportExportReady,
} from '../report-export'

export function registerReportIpcHandlers() {
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

  ipcMain.handle(IPC_CHANNELS.notifyReportExportError, (_event, input: ReportExportErrorInput) => {
    return notifyReportExportError(input)
  })
}
