import { onBeforeUnmount, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import type { EditorMode } from '../../types/ui'
import { useReportsPanel } from '../../components/report/composables/useReportsPanel'
import { applyThemePreference, observeSystemThemeChange } from '../../shared/theme/apply'
import { useAppShellAi } from './app-shell/ai'
import { useAppShellJournal } from './app-shell/journal'
import { useAppShellPreferences } from './app-shell/preferences'
import { useAppShellState } from './app-shell/state'

export function useAppShell() {
  const state = useAppShellState()
  const reportsPanel = useReportsPanel(state.workspacePath)
  const journal = useAppShellJournal(state)
  const preferences = useAppShellPreferences(state, {
    applyNoWorkspaceState: journal.applyNoWorkspaceState,
    loadEntryForDate: journal.loadEntryForDate,
    syncConfigState: journal.syncConfigState,
  })
  const ai = useAppShellAi(state)

  let removeWindowZoomListener: (() => void) | null = null
  let removeMainPanelNavigationListener: (() => void) | null = null
  let removeProfileRebuildProgressListener: (() => void) | null = null
  let removeSystemThemeListener: (() => void) | null = null
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    state.isDirty,
    (value) => {
      if (state.isReportExportMode) {
        return
      }

      void window.dairy.setWindowDirtyState({ isDirty: value })
    },
    { immediate: true },
  )

  watch(
    state.theme,
    (value) => {
      applyThemePreference(value)
    },
    { immediate: true },
  )

  function computeNextBoundary() {
    const now = dayjs()
    const todayBoundary = now.startOf('day').add(state.dayStartHour.value, 'hour')
    if (now.isBefore(todayBoundary)) {
      return todayBoundary.valueOf()
    }
    return todayBoundary.add(1, 'day').valueOf()
  }

  function clearBoundaryTimer() {
    if (boundaryTimer !== null) {
      clearTimeout(boundaryTimer)
      boundaryTimer = null
    }
  }

  function scheduleDayBoundary() {
    clearBoundaryTimer()
    const targetMs = computeNextBoundary()
    const delay = Math.max(0, targetMs - Date.now())
    boundaryTimer = setTimeout(() => {
      const wasOnToday = state.isSelectedDateToday.value
      state.updateTimeTick()
      if (wasOnToday) {
        state.selectedDate.value = state.todayText.value
      }
      scheduleDayBoundary()
    }, delay)
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    const wasOnToday = state.isSelectedDateToday.value
    state.updateTimeTick()
    if (wasOnToday) {
      state.selectedDate.value = state.todayText.value
    }
    scheduleDayBoundary()
  }

  watch(state.dayStartHour, () => {
    scheduleDayBoundary()
  })

  onMounted(async () => {
    if (state.isReportExportMode) {
      return
    }

    removeWindowZoomListener = window.dairy.onWindowZoomFactorChanged((nextZoomFactor) => {
      state.windowZoomFactor.value = nextZoomFactor
    })
    removeMainPanelNavigationListener = window.dairy.onNavigateMainPanel((panel) => {
      state.rightPanel.value = panel
    })
    removeProfileRebuildProgressListener = window.dairy.onUserProfileRebuildProgress(
      (progress) => {
        state.profileRebuildProgress.value = progress
      },
    )
    removeSystemThemeListener = observeSystemThemeChange(() => {
      if (state.theme.value === 'system') {
        applyThemePreference(state.theme.value)
      }
    })
    window.addEventListener('keydown', journal.handleWindowKeydown)
    await journal.bootstrapApp()
    scheduleDayBoundary()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    if (state.isReportExportMode) {
      return
    }

    removeWindowZoomListener?.()
    removeWindowZoomListener = null
    removeMainPanelNavigationListener?.()
    removeMainPanelNavigationListener = null
    removeProfileRebuildProgressListener?.()
    removeProfileRebuildProgressListener = null
    removeSystemThemeListener?.()
    removeSystemThemeListener = null
    clearBoundaryTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('keydown', journal.handleWindowKeydown)
  })

  function setEditorMode(mode: EditorMode) {
    state.editorMode.value = mode
  }

  function openSettingsPage() {
    state.rightPanel.value = 'settings'
  }

  function openReportsPage() {
    state.rightPanel.value = 'reports'
  }

  function openJournalPage() {
    state.rightPanel.value = 'journal'
  }

  function openTimelinePage() {
    state.rightPanel.value = 'timeline'
  }

  return {
    ...state,
    ...journal,
    ...preferences,
    ...ai,
    handleUpdateLaunchOnStartupEnabled: preferences.handleUpdateLaunchOnStartupEnabled,
    handleUpdateEmailNotificationEnabled: preferences.handleUpdateEmailNotificationEnabled,
    handleUpdateNotificationReminderTime: preferences.handleUpdateNotificationReminderTime,
    handleUpdateSystemNotificationEnabled: preferences.handleUpdateSystemNotificationEnabled,
    handleUpdateTheme: preferences.handleUpdateTheme,
    handleUpdateWindowCloseBehavior: preferences.handleUpdateWindowCloseBehavior,
    openJournalPage,
    openTimelinePage,
    openReportsPage,
    openSettingsPage,
    reportsPanel,
    setEditorMode,
  }
}
