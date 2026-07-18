import { dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import type {
  OpenWorkspaceFolderInput,
  WorkspaceSelectionResult,
  WorkspaceStringListInput,
} from '../../../src/types/workspace'
import {
  buildWorkspaceConfig,
  readAppConfig,
  writeAppConfig,
} from '../app-config'
import { IPC_CHANNELS } from '../constants'
import {
  getMainWindow,
} from '../window'
import {
  getWorkspaceLocationOptions,
  getWorkspaceTags,
  getWorkspaceWeatherOptions,
  setWorkspaceLocationOptions,
  setWorkspaceTags,
  setWorkspaceWeatherOptions,
} from '../workspace/libraries'

export function registerWorkspaceIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.chooseWorkspace, async (): Promise<WorkspaceSelectionResult> => {
    const currentConfig = await readAppConfig()
    const dialogOptions: OpenDialogOptions = {
      title: '选择日记目录',
      buttonLabel: '选择这个目录',
      properties: ['openDirectory'],
      defaultPath: currentConfig.lastOpenedWorkspace ?? undefined,
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

  ipcMain.handle(
    IPC_CHANNELS.openWorkspaceFolder,
    async (_event, input: OpenWorkspaceFolderInput) => {
      const workspacePath = input.workspacePath.trim()

      if (!workspacePath) {
        throw new Error('当前还没有可打开的工作区目录。')
      }

      const errorMessage = await shell.openPath(workspacePath)
      if (errorMessage) {
        throw new Error(`打开目录失败：${errorMessage}`)
      }
    },
  )

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
}
