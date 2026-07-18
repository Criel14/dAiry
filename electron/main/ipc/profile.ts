import { ipcMain } from 'electron'
import type { RebuildUserProfileInput } from '../../../src/types/ai'
import { IPC_CHANNELS } from '../constants'
import { cancelUserProfileRebuild, rebuildUserProfile } from '../profile'
import { getMainWindow } from '../window'

export function registerProfileIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.rebuildUserProfile, (_event, input: RebuildUserProfileInput) => {
    return rebuildUserProfile(input, (progress) => {
      const win = getMainWindow()
      if (!win || win.isDestroyed()) {
        return
      }

      win.webContents.send(IPC_CHANNELS.userProfileRebuildProgress, progress)
    })
  })

  ipcMain.handle(IPC_CHANNELS.cancelUserProfileRebuild, () => {
    cancelUserProfileRebuild()
  })
}
