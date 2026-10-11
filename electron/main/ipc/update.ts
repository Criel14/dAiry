import { ipcMain } from 'electron'
import { getUpdateCheckState } from '../update/service'
import { IPC_CHANNELS } from '../constants'

export function registerUpdateIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getUpdateCheckState, () => {
    return getUpdateCheckState()
  })
}
