import type {
  AppConfig,
  AppTheme,
  FrontmatterVisibilityConfig,
  NotificationConfig,
  WindowCloseBehavior,
} from '../../../types/app'
import { formatWindowZoomPercent } from '../../../shared/window-zoom'
import { normalizeStringList, type AppShellState } from './state'

interface AppShellPreferenceDeps {
  applyNoWorkspaceState: () => void
  loadEntryForDate: (dateText: string) => Promise<void>
  syncConfigState: (config: AppConfig) => void
}

export function useAppShellPreferences(
  state: AppShellState,
  deps: AppShellPreferenceDeps,
) {
  async function handleUpdateJournalHeatmapEnabled(nextValue: boolean) {
    state.isSavingJournalHeatmap.value = true
    state.heatmapSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setJournalHeatmapEnabled({
        enabled: nextValue,
      })

      deps.syncConfigState(nextConfig)
      state.heatmapSaveMessage.value =
        nextValue ? '已开启字数热力图。' : '已关闭字数热力图。'
    } catch (error) {
      state.heatmapSaveMessage.value =
        error instanceof Error ? error.message : '保存显示设置失败，请稍后重试。'
    } finally {
      state.isSavingJournalHeatmap.value = false
    }
  }

  async function handleUpdateTheme(nextValue: AppTheme) {
    state.isSavingTheme.value = true
    state.themeSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setThemePreference({
        theme: nextValue,
      })

      deps.syncConfigState(nextConfig)
      state.themeSaveMessage.value =
        nextValue === 'system'
          ? '主题模式已切换为跟随系统，当前先保留现有视觉。'
          : `主题模式已切换为${nextValue === 'light' ? '浅色' : '深色'}，样式方案会后续补齐。`
    } catch (error) {
      state.themeSaveMessage.value =
        error instanceof Error ? error.message : '保存主题模式失败，请稍后重试。'
    } finally {
      state.isSavingTheme.value = false
    }
  }

  async function handleUpdateWindowZoomFactor(nextValue: number) {
    state.isSavingWindowZoomFactor.value = true
    state.windowZoomFactorSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setWindowZoomFactor({
        zoomFactor: nextValue,
      })

      deps.syncConfigState(nextConfig)
      state.windowZoomFactorSaveMessage.value = `界面缩放已调整为 ${formatWindowZoomPercent(
        nextConfig.ui.zoomFactor,
      )}。`
    } catch (error) {
      state.windowZoomFactorSaveMessage.value =
        error instanceof Error ? error.message : '保存界面缩放失败，请稍后重试。'
    } finally {
      state.isSavingWindowZoomFactor.value = false
    }
  }

  async function handleUpdateDayStartHour(nextValue: number) {
    const wasSelectedToday = state.isSelectedDateToday.value
    state.isSavingDayStartHour.value = true
    state.dayStartHourSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setDayStartHour({
        hour: nextValue,
      })

      deps.syncConfigState(nextConfig)

      if (wasSelectedToday) {
        state.selectedDate.value = state.todayText.value
      }

      if (state.workspacePath.value) {
        await deps.loadEntryForDate(state.selectedDate.value)
      } else {
        deps.applyNoWorkspaceState()
      }

      state.dayStartHourSaveMessage.value = '新一天开始时间已保存。'
    } catch (error) {
      state.dayStartHourSaveMessage.value =
        error instanceof Error ? error.message : '保存新一天开始时间失败，请稍后重试。'
    } finally {
      state.isSavingDayStartHour.value = false
    }
  }

  async function handleUpdateFrontmatterVisibility(
    nextVisibility: FrontmatterVisibilityConfig,
  ) {
    state.isSavingFrontmatterVisibility.value = true
    state.frontmatterVisibilitySaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setFrontmatterVisibility({
        visibility: nextVisibility,
      })

      deps.syncConfigState(nextConfig)
      state.frontmatterVisibilitySaveMessage.value = '日记信息展示设置已保存。'
    } catch (error) {
      state.frontmatterVisibilitySaveMessage.value =
        error instanceof Error ? error.message : '保存日记信息展示设置失败，请稍后重试。'
    } finally {
      state.isSavingFrontmatterVisibility.value = false
    }
  }

  async function saveNotificationPreference(
    nextNotification: NotificationConfig,
    successMessage: string,
  ) {
    state.isSavingNotification.value = true
    state.notificationSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setNotificationPreference(nextNotification)
      deps.syncConfigState(nextConfig)
      state.notificationSaveMessage.value = successMessage
    } catch (error) {
      state.notificationSaveMessage.value =
        error instanceof Error ? error.message : '保存通知设置失败，请稍后重试。'
    } finally {
      state.isSavingNotification.value = false
    }
  }

  async function handleUpdateNotificationEnabled(nextValue: boolean) {
    await saveNotificationPreference(
      {
        ...state.notification.value,
        enabled: nextValue,
      },
      nextValue ? '写日记提醒已开启。' : '写日记提醒已关闭。',
    )
  }

  async function handleUpdateNotificationReminderTime(nextValue: string) {
    await saveNotificationPreference(
      {
        ...state.notification.value,
        reminderTime: nextValue,
      },
      '写日记提醒时间已保存。',
    )
  }

  async function handleUpdateWindowCloseBehavior(nextValue: WindowCloseBehavior) {
    state.isSavingWindowCloseBehavior.value = true
    state.windowCloseBehaviorSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setWindowCloseBehavior({
        behavior: nextValue,
      })

      deps.syncConfigState(nextConfig)
      state.windowCloseBehaviorSaveMessage.value =
        nextValue === 'tray'
          ? '关闭窗口时将最小化到托盘。'
          : '关闭窗口时将直接退出应用。'
    } catch (error) {
      state.windowCloseBehaviorSaveMessage.value =
        error instanceof Error ? error.message : '保存关闭窗口行为失败，请稍后重试。'
    } finally {
      state.isSavingWindowCloseBehavior.value = false
    }
  }

  async function handleSaveWorkspaceLibraries(input: {
    tags: string[]
    weatherOptions: string[]
    locationOptions: string[]
  }) {
    if (!state.workspacePath.value) {
      return
    }

    state.isSavingWorkspaceLibraries.value = true
    state.workspaceLibrariesSaveMessage.value = ''

    try {
      const normalizedTags = normalizeStringList(input.tags)
      const normalizedWeatherOptions = normalizeStringList(input.weatherOptions)
      const normalizedLocationOptions = normalizeStringList(input.locationOptions)

      const [nextTags, nextWeatherOptions, nextLocationOptions] = await Promise.all([
        window.dairy.setWorkspaceTags({
          workspacePath: state.workspacePath.value,
          items: normalizedTags,
        }),
        window.dairy.setWorkspaceWeatherOptions({
          workspacePath: state.workspacePath.value,
          items: normalizedWeatherOptions,
        }),
        window.dairy.setWorkspaceLocationOptions({
          workspacePath: state.workspacePath.value,
          items: normalizedLocationOptions,
        }),
      ])

      state.workspaceTags.value = nextTags
      state.workspaceWeatherOptions.value = nextWeatherOptions
      state.workspaceLocationOptions.value = nextLocationOptions
      state.workspaceLibrariesSaveMessage.value = '候选词库已保存。'
    } catch (error) {
      state.workspaceLibrariesSaveMessage.value =
        error instanceof Error ? error.message : '保存候选词库失败，请稍后重试。'
    } finally {
      state.isSavingWorkspaceLibraries.value = false
    }
  }

  return {
    handleSaveWorkspaceLibraries,
    handleUpdateDayStartHour,
    handleUpdateFrontmatterVisibility,
    handleUpdateJournalHeatmapEnabled,
    handleUpdateNotificationEnabled,
    handleUpdateNotificationReminderTime,
    handleUpdateTheme,
    handleUpdateWindowCloseBehavior,
    handleUpdateWindowZoomFactor,
  }
}
