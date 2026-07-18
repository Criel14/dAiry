import { registerAppIpcHandlers } from './app'
import { registerJournalIpcHandlers } from './journal'
import { registerProfileIpcHandlers } from './profile'
import { registerReportIpcHandlers } from './report'
import { registerWorkspaceIpcHandlers } from './workspace'

export function registerIpcHandlers() {
  registerAppIpcHandlers()
  registerWorkspaceIpcHandlers()
  registerJournalIpcHandlers()
  registerProfileIpcHandlers()
  registerReportIpcHandlers()
}
