import { registerAppIpcHandlers } from './app'
import { registerBillsIpcHandlers } from './bills'
import { registerJournalIpcHandlers } from './journal'
import { registerMcpIpcHandlers } from './mcp'
import { registerProfileIpcHandlers } from './profile'
import { registerReportIpcHandlers } from './report'
import { registerTimelineIpcHandlers } from './timeline'
import { registerWorkspaceIpcHandlers } from './workspace'

export function registerIpcHandlers() {
  registerAppIpcHandlers()
  registerWorkspaceIpcHandlers()
  registerJournalIpcHandlers()
  registerProfileIpcHandlers()
  registerReportIpcHandlers()
  registerTimelineIpcHandlers()
  registerMcpIpcHandlers()
  registerBillsIpcHandlers()
}
