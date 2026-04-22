import dayjs from 'dayjs'
import type { AppConfig } from '../../../types/app'
import type {
  JournalEntryMetadata,
  JournalEntryReadResult,
} from '../../../types/journal'
import type { WorkspaceSelectionResult } from '../../../types/workspace'
import {
  cloneMetadata,
  createEmptyMetadata,
  frontmatterToMetadata,
  metadataToSnapshot,
  normalizeMetadata,
  type AppShellState,
} from './state'

function createDateRelationResolver(state: AppShellState) {
  return (dateText: string) => {
    const currentDate = dayjs(dateText)
    const todayDate = dayjs(state.todayText.value)

    if (currentDate.isSame(todayDate, 'day')) {
      return 'today'
    }

    return currentDate.isBefore(todayDate, 'day') ? 'past' : 'future'
  }
}

export function useAppShellJournal(state: AppShellState) {
  let loadSequence = 0
  const getDateRelation = createDateRelationResolver(state)

  function syncConfigState(config: AppConfig) {
    state.workspacePath.value = config.lastOpenedWorkspace
    state.theme.value = config.ui.theme
    state.windowZoomFactor.value = config.ui.zoomFactor
    state.isJournalHeatmapEnabled.value = config.ui.journalHeatmapEnabled
    state.dayStartHour.value = config.ui.dayStartHour
    state.windowCloseBehavior.value = config.ui.closeBehavior
    state.frontmatterVisibility.value = {
      ...config.ui.frontmatterVisibility,
    }
  }

  function resetTransientState() {
    state.editorContent.value = ''
    state.savedContent.value = ''
    state.frontmatter.value = null
    state.metadataDraft.value = createEmptyMetadata()
    state.savedMetadataSnapshot.value = metadataToSnapshot(createEmptyMetadata())
    state.statusMessage.value = ''
    state.metadataStatusMessage.value = ''
    state.dailyInsightsStatusMessage.value = ''
    state.themeSaveMessage.value = ''
    state.windowCloseBehaviorSaveMessage.value = ''
    state.lastSavedAt.value = null
  }

  function applyNoWorkspaceState() {
    resetTransientState()
    state.viewState.value = 'no-workspace'
  }

  function applyMissingEntryState(dateText: string) {
    resetTransientState()

    const relation = getDateRelation(dateText)
    if (relation === 'today') {
      state.viewState.value = 'today-empty'
      return
    }

    if (relation === 'future') {
      state.viewState.value = 'future-empty'
      return
    }

    state.viewState.value = 'history-empty'
  }

  function applyReadyState(entry: JournalEntryReadResult) {
    if (entry.status !== 'ready' || !entry.frontmatter) {
      return
    }

    const nextMetadata = frontmatterToMetadata(entry.frontmatter)

    state.viewState.value = 'ready'
    state.editorContent.value = entry.body ?? ''
    state.savedContent.value = entry.body ?? ''
    state.frontmatter.value = entry.frontmatter
    state.metadataDraft.value = cloneMetadata(nextMetadata)
    state.savedMetadataSnapshot.value = metadataToSnapshot(nextMetadata)
    state.statusMessage.value = ''
    state.metadataStatusMessage.value = ''
    state.dailyInsightsStatusMessage.value = ''
    state.lastSavedAt.value = entry.frontmatter.updatedAt
  }

  function applyErrorState(error: unknown) {
    resetTransientState()
    state.viewState.value = 'error'
    state.statusMessage.value =
      error instanceof Error ? error.message : '读取数据时发生未知错误。'
  }

  async function confirmDiscardChanges() {
    if (!state.isDirty.value) {
      return true
    }

    return window.confirm('当前内容还没有保存，继续切换会丢失修改。要继续吗？')
  }

  async function loadWorkspaceTags() {
    if (!state.workspacePath.value) {
      state.workspaceTags.value = []
      return
    }

    try {
      state.workspaceTags.value = await window.dairy.getWorkspaceTags(state.workspacePath.value)
    } catch {
      state.workspaceTags.value = []
    }
  }

  async function loadWorkspaceWeatherOptions() {
    if (!state.workspacePath.value) {
      state.workspaceWeatherOptions.value = []
      return
    }

    try {
      state.workspaceWeatherOptions.value = await window.dairy.getWorkspaceWeatherOptions(
        state.workspacePath.value,
      )
    } catch {
      state.workspaceWeatherOptions.value = []
    }
  }

  async function loadWorkspaceLocationOptions() {
    if (!state.workspacePath.value) {
      state.workspaceLocationOptions.value = []
      return
    }

    try {
      state.workspaceLocationOptions.value = await window.dairy.getWorkspaceLocationOptions(
        state.workspacePath.value,
      )
    } catch {
      state.workspaceLocationOptions.value = []
    }
  }

  async function bootstrapApp() {
    resetTransientState()
    state.viewState.value = 'loading'

    try {
      const [bootstrap, nextAiSettingsStatus, nextAiContextDocument] = await Promise.all([
        window.dairy.getAppBootstrap(),
        window.dairy.getAiSettingsStatus(),
        window.dairy.getAiContext(),
      ])

      syncConfigState(bootstrap.config)
      state.aiSettingsStatus.value = nextAiSettingsStatus
      state.aiContextDocument.value = nextAiContextDocument
      state.selectedDate.value = state.todayText.value

      if (!state.workspacePath.value) {
        state.workspaceLocationOptions.value = []
        state.workspaceWeatherOptions.value = []
        state.workspaceTags.value = []
        applyNoWorkspaceState()
        return
      }

      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
        loadEntryForDate(state.selectedDate.value),
      ])
    } catch (error) {
      applyErrorState(error)
    }
  }

  async function handleSelectDate(nextDate: string) {
    if (nextDate === state.selectedDate.value) {
      return
    }

    if (!(await confirmDiscardChanges())) {
      return
    }

    state.selectedDate.value = nextDate
    state.rightPanel.value = 'journal'

    if (!state.workspacePath.value) {
      applyNoWorkspaceState()
      return
    }

    await loadEntryForDate(nextDate)
  }

  function applyWorkspaceSelection(result: WorkspaceSelectionResult) {
    syncConfigState(result.config)
    state.workspacePath.value = result.workspacePath
  }

  async function handleChooseWorkspace() {
    if (!(await confirmDiscardChanges())) {
      return
    }

    try {
      const result = await window.dairy.chooseWorkspace()
      if (result.canceled || !result.workspacePath) {
        return
      }

      applyWorkspaceSelection(result)
      state.selectedDate.value = state.todayText.value
      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
        loadEntryForDate(state.selectedDate.value),
      ])
    } catch (error) {
      applyErrorState(error)
    }
  }

  async function loadEntryForDate(dateText: string) {
    if (!state.workspacePath.value) {
      applyNoWorkspaceState()
      return
    }

    const currentLoad = ++loadSequence
    const shouldShowLoadingState =
      state.viewState.value === 'loading' ||
      state.viewState.value === 'error' ||
      state.viewState.value === 'no-workspace'

    if (shouldShowLoadingState) {
      state.viewState.value = 'loading'
    }

    state.statusMessage.value = ''
    state.metadataStatusMessage.value = ''
    state.dailyInsightsStatusMessage.value = ''

    try {
      const result = await window.dairy.readJournalEntry({
        workspacePath: state.workspacePath.value,
        date: dateText,
      })

      if (currentLoad !== loadSequence) {
        return
      }

      if (result.status === 'missing') {
        applyMissingEntryState(dateText)
        return
      }

      applyReadyState(result)
    } catch (error) {
      if (currentLoad !== loadSequence) {
        return
      }

      applyErrorState(error)
    }
  }

  async function handleCreateEntry() {
    if (!state.workspacePath.value || !state.canCreateEntry.value) {
      return
    }

    state.isCreatingEntry.value = true

    try {
      const result = await window.dairy.createJournalEntry({
        workspacePath: state.workspacePath.value,
        date: state.selectedDate.value,
      })

      applyReadyState(result)
      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
      ])
      state.statusMessage.value = state.isSelectedDateToday.value
        ? '已经创建今天的日记，可以开始写了。'
        : `已经创建 ${state.selectedDateText.value} 的日记，可以开始补写了。`
    } catch (error) {
      applyErrorState(error)
    } finally {
      state.isCreatingEntry.value = false
    }
  }

  async function handleSaveEntry() {
    if (
      !state.workspacePath.value ||
      state.viewState.value !== 'ready' ||
      !state.canSaveEntry.value
    ) {
      return
    }

    state.isSavingEntry.value = true

    try {
      const result = await window.dairy.saveJournalEntryBody({
        workspacePath: state.workspacePath.value,
        date: state.selectedDate.value,
        body: state.editorContent.value,
      })

      state.savedContent.value = state.editorContent.value
      state.lastSavedAt.value = result.savedAt
      state.statusMessage.value = '正文已保存。'

      if (state.frontmatter.value) {
        state.frontmatter.value = {
          ...state.frontmatter.value,
          updatedAt: result.savedAt,
        }
      }
    } catch (error) {
      state.statusMessage.value =
        error instanceof Error ? error.message : '保存正文失败，请稍后重试。'
    } finally {
      state.isSavingEntry.value = false
    }
  }

  async function handleSaveMetadata() {
    if (
      !state.workspacePath.value ||
      state.viewState.value !== 'ready' ||
      !state.canSaveMetadata.value
    ) {
      return
    }

    state.isSavingMetadata.value = true

    try {
      const normalizedMetadata = normalizeMetadata(state.metadataDraft.value)
      const result = await window.dairy.saveJournalEntryMetadata({
        workspacePath: state.workspacePath.value,
        date: state.selectedDate.value,
        metadata: normalizedMetadata,
      })

      state.metadataDraft.value = cloneMetadata(normalizedMetadata)
      state.savedMetadataSnapshot.value = metadataToSnapshot(normalizedMetadata)
      state.lastSavedAt.value = result.savedAt
      state.metadataStatusMessage.value = '日记信息已保存。'

      if (state.frontmatter.value) {
        state.frontmatter.value = {
          ...state.frontmatter.value,
          ...normalizedMetadata,
          updatedAt: result.savedAt,
        }
      }

      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
      ])
    } catch (error) {
      state.metadataStatusMessage.value =
        error instanceof Error ? error.message : '保存日记信息失败，请稍后重试。'
    } finally {
      state.isSavingMetadata.value = false
    }
  }

  async function handleGenerateDailyInsights() {
    if (!state.workspacePath.value || state.viewState.value !== 'ready') {
      return
    }

    if (!state.editorContent.value.trim()) {
      state.dailyInsightsStatusMessage.value = '正文为空，暂时无法自动整理。'
      return
    }

    if (!state.aiSettingsStatus.value.isConfigured) {
      state.dailyInsightsStatusMessage.value =
        '请先在设置页完成大模型配置和 API Key 保存。'
      return
    }

    if (
      state.metadataDraft.value.summary.trim() ||
      state.metadataDraft.value.tags.length > 0 ||
      state.metadataDraft.value.mood !== 0
    ) {
      const shouldContinue = window.confirm(
        '自动整理会覆盖当前的一句话总结、标签和心情，是否继续？',
      )
      if (!shouldContinue) {
        return
      }
    }

    state.isGeneratingDailyInsights.value = true
    state.dailyInsightsStatusMessage.value = ''

    try {
      const result = await window.dairy.generateDailyInsights({
        workspacePath: `${state.workspacePath.value}`,
        date: `${state.selectedDate.value}`,
        body: `${state.editorContent.value}`,
        workspaceTags: [...state.workspaceTags.value],
      })

      state.metadataDraft.value = cloneMetadata({
        ...state.metadataDraft.value,
        mood: result.mood,
        summary: result.summary,
        tags: result.tags,
      })

      state.dailyInsightsStatusMessage.value =
        result.newTags.length > 0
          ? `已生成总结、标签和心情。保存信息后会新增 ${result.newTags.length} 个候选标签。`
          : '已生成总结、标签和心情。'
    } catch (error) {
      state.dailyInsightsStatusMessage.value =
        error instanceof Error ? error.message : '自动整理失败，请稍后重试。'
    } finally {
      state.isGeneratingDailyInsights.value = false
    }
  }

  async function handleSaveAll() {
    if (!state.workspacePath.value || state.viewState.value !== 'ready') {
      return
    }

    if (
      state.isSavingEntry.value ||
      state.isSavingMetadata.value ||
      state.isGeneratingDailyInsights.value
    ) {
      return
    }

    if (state.canSaveMetadata.value) {
      await handleSaveMetadata()
    }

    if (state.canSaveEntry.value) {
      await handleSaveEntry()
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void handleSaveAll()
    }
  }

  function handleUpdateMetadata(nextMetadata: JournalEntryMetadata) {
    state.metadataDraft.value = cloneMetadata({
      ...nextMetadata,
      mood:
        typeof nextMetadata.mood === 'number' &&
        Number.isInteger(nextMetadata.mood) &&
        nextMetadata.mood >= -5 &&
        nextMetadata.mood <= 5
          ? nextMetadata.mood
          : 0,
      tags: [...new Set(nextMetadata.tags.map((tag) => tag.trim()).filter(Boolean))],
    })
    state.metadataStatusMessage.value = ''
    state.dailyInsightsStatusMessage.value = ''
  }

  return {
    applyNoWorkspaceState,
    bootstrapApp,
    handleChooseWorkspace,
    handleCreateEntry,
    handleGenerateDailyInsights,
    handleSaveAll,
    handleSaveEntry,
    handleSaveMetadata,
    handleSelectDate,
    handleUpdateMetadata,
    handleWindowKeydown,
    loadEntryForDate,
    syncConfigState,
  }
}
