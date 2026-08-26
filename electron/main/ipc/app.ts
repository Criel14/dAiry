import { dialog, ipcMain, shell } from 'electron'
import type {
  SaveAiApiKeyInput,
  SaveSupplementInput,
  SaveAiSettingsInput,
} from '../../../src/types/ai'
import type {
  AppBootstrap,
  DayStartHourPreferenceInput,
  FrontmatterVisibilityInput,
  JournalHeatmapPreferenceInput,
  LaunchOnStartupPreferenceInput,
  NotificationPreferenceInput,
  OpenExternalLinkInput,
  SaveEmailNotificationAuthCodeInput,
  ShowMessageBoxInput,
  ThemePreferenceInput,
  WindowCloseBehaviorPreferenceInput,
  WindowDirtyStateInput,
  WindowZoomPreferenceInput,
} from '../../../src/types/app'
import {
  readAppConfig,
  setDayStartHour,
  setFrontmatterVisibility,
  setJournalHeatmapEnabled,
  setLaunchOnStartupPreference,
  setNotificationPreference,
  setThemePreference,
  setWindowCloseBehavior,
} from '../app-config'
import { getAiSettingsStatus, saveAiSettings } from '../ai/config'
import { getSupplementDocument, saveSupplement } from '../ai/context'
import {
  getEmailNotificationStatus,
  saveAiApiKey,
  saveEmailNotificationAuthCode,
} from '../secrets'
import { IPC_CHANNELS } from '../constants'
import { applyLaunchOnStartup } from '../launch-on-startup'
import { configureDiaryReminder } from '../notification'
import {
  getMainWindow,
  openMainWindowDevTools,
  applyNativeThemeSource,
  applyWindowCloseBehavior,
  setWindowDirtyState,
  updateWindowZoomFactor,
} from '../window'

export function registerAppIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.getBootstrap, async (): Promise<AppBootstrap> => {
    const config = await readAppConfig()
    const emailNotificationStatus = await getEmailNotificationStatus()
    return { config, emailNotificationStatus }
  })

  ipcMain.handle(IPC_CHANNELS.getThemePreference, async () => {
    const config = await readAppConfig()
    return config.ui.theme
  })

  ipcMain.handle(IPC_CHANNELS.getAiSettingsStatus, () => {
    return getAiSettingsStatus()
  })

  ipcMain.handle(IPC_CHANNELS.setThemePreference, async (_event, input: ThemePreferenceInput) => {
    const nextConfig = await setThemePreference(input)
    applyNativeThemeSource(nextConfig.ui.theme)
    return nextConfig
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

  ipcMain.handle(IPC_CHANNELS.getSupplement, (_event, workspacePath: string) => {
    return getSupplementDocument(workspacePath)
  })

  ipcMain.handle(IPC_CHANNELS.saveSupplement, (_event, input: SaveSupplementInput) => {
    return saveSupplement(input.workspacePath, input)
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
    IPC_CHANNELS.setWindowCloseBehavior,
    async (_event, input: WindowCloseBehaviorPreferenceInput) => {
      const nextConfig = await setWindowCloseBehavior(input)
      applyWindowCloseBehavior(nextConfig.ui.closeBehavior)
      return nextConfig
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.setLaunchOnStartupPreference,
    async (_event, input: LaunchOnStartupPreferenceInput) => {
      applyLaunchOnStartup(input.enabled)
      return setLaunchOnStartupPreference(input)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.setNotificationPreference,
    async (_event, input: NotificationPreferenceInput) => {
      const nextConfig = await setNotificationPreference(input)
      configureDiaryReminder(nextConfig.ui.notification)
      return nextConfig
    },
  )

  ipcMain.handle(IPC_CHANNELS.getEmailNotificationStatus, () => {
    return getEmailNotificationStatus()
  })

  ipcMain.handle(
    IPC_CHANNELS.saveEmailNotificationAuthCode,
    (_event, input: SaveEmailNotificationAuthCodeInput) => {
      return saveEmailNotificationAuthCode(input)
    },
  )

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

  ipcMain.handle(IPC_CHANNELS.showMessageBox, async (_event, input: ShowMessageBoxInput) => {
    const options: Electron.MessageBoxOptions = {
      type: input.type ?? 'info',
      title: input.title ?? 'dAiry',
      message: input.message,
      detail: input.detail,
      buttons: input.buttons ?? ['确定'],
      defaultId: input.defaultId ?? 0,
      cancelId: input.cancelId ?? 0,
      noLink: true,
    }
    const parentWindow = getMainWindow()
    const { response } = parentWindow
      ? await dialog.showMessageBox(parentWindow, options)
      : await dialog.showMessageBox(options)
    return response
  })
}
