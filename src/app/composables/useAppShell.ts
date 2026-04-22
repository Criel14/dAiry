import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { EditorMode } from '../../types/ui'
import { useReportsPanel } from '../../components/report/composables/useReportsPanel'
import { applyThemePreference, observeSystemThemeChange } from '../../shared/theme'
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
  let removeSystemThemeListener: (() => void) | null = null

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
    removeSystemThemeListener = observeSystemThemeChange(() => {
      if (state.theme.value === 'system') {
        applyThemePreference(state.theme.value)
      }
    })
    window.addEventListener('keydown', journal.handleWindowKeydown)
    await journal.bootstrapApp()
  })

  onBeforeUnmount(() => {
    if (state.isReportExportMode) {
      return
    }

    removeWindowZoomListener?.()
    removeWindowZoomListener = null
    removeMainPanelNavigationListener?.()
    removeMainPanelNavigationListener = null
    removeSystemThemeListener?.()
    removeSystemThemeListener = null
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

  return {
    ...state,
    ...journal,
    ...preferences,
    ...ai,
    handleUpdateNotificationEnabled: preferences.handleUpdateNotificationEnabled,
    handleUpdateNotificationReminderTime: preferences.handleUpdateNotificationReminderTime,
    handleUpdateTheme: preferences.handleUpdateTheme,
    handleUpdateWindowCloseBehavior: preferences.handleUpdateWindowCloseBehavior,
    openJournalPage,
    openReportsPage,
    openSettingsPage,
    reportsPanel,
    setEditorMode,
  }
}
