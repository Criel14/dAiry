import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { AiSettingsStatus, SupplementDocument, UserProfileRebuildProgress } from '../../../types/ai'
import type { McpRuntimeStatus } from '../../../types/mcp'
import type {
  AppTheme,
  EmailNotificationSecretStatus,
  FrontmatterVisibilityConfig,
  NotificationConfig,
  WindowCloseBehavior,
} from '../../../types/app'
import type { JournalEntryMetadata, JournalFrontmatter } from '../../../types/journal'
import type { EditorMode, RightPanel, ViewState } from '../../../types/ui'
import type { SettingsSectionId } from '../../../components/settings/config/config'
import {
  createDefaultFrontmatterVisibility,
  createDefaultNotificationConfig,
  DEFAULT_AI_SETTINGS,
  EMPTY_METADATA,
} from '../../../shared/defaults'

export { createDefaultFrontmatterVisibility }

export function createDefaultAiSettingsStatus(): AiSettingsStatus {
  return {
    settings: { ...DEFAULT_AI_SETTINGS },
    hasApiKey: false,
    isConfigured: false,
  }
}

export function createDefaultSupplementDocument(): SupplementDocument {
  return {
    content: '',
  }
}

export function createDefaultEmailNotificationStatus(): EmailNotificationSecretStatus {
  return {
    hasAuthCode: false,
    isConfigured: false,
  }
}

export function createDefaultMcpRuntimeStatus(): McpRuntimeStatus {
  return {
    status: 'stopped',
    port: null,
    errorMessage: null,
  }
}

export function createDefaultLaunchOnStartupPreference() {
  return true
}

export function normalizeStringList(values: string[]) {
  const uniqueValues = new Set<string>()

  for (const value of values) {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      continue
    }

    uniqueValues.add(normalizedValue)
  }

  return [...uniqueValues]
}

export function createEmptyMetadata(): JournalEntryMetadata {
  return { ...EMPTY_METADATA, tags: [] }
}

export function cloneMetadata(metadata: JournalEntryMetadata): JournalEntryMetadata {
  return {
    weather: metadata.weather,
    location: metadata.location,
    mood: metadata.mood,
    summary: metadata.summary,
    tags: [...metadata.tags],
  }
}

export function normalizeMetadata(metadata: JournalEntryMetadata): JournalEntryMetadata {
  const uniqueTags = new Set<string>()

  for (const tag of metadata.tags) {
    const normalizedTag = tag.trim()
    if (!normalizedTag) {
      continue
    }

    uniqueTags.add(normalizedTag)
  }

  return {
    weather: metadata.weather.trim(),
    location: metadata.location.trim(),
    mood:
      typeof metadata.mood === 'number' &&
      Number.isInteger(metadata.mood) &&
      metadata.mood >= -5 &&
      metadata.mood <= 5
        ? metadata.mood
        : 0,
    summary: metadata.summary.trim(),
    tags: [...uniqueTags],
  }
}

export function metadataToSnapshot(metadata: JournalEntryMetadata) {
  return JSON.stringify(normalizeMetadata(metadata))
}

export function frontmatterToMetadata(frontmatter: JournalFrontmatter): JournalEntryMetadata {
  return {
    weather: frontmatter.weather,
    location: frontmatter.location,
    mood: frontmatter.mood,
    summary: frontmatter.summary,
    tags: [...frontmatter.tags],
  }
}

export function getJournalDateText(hour: number, baseDate = dayjs()) {
  return baseDate.subtract(hour, 'hour').format('YYYY-MM-DD')
}

export function useAppShellState() {
  const selectedDate = ref(getJournalDateText(0))
  const workspacePath = ref<string | null>(null)
  const workspaceLocationOptions = ref<string[]>([])
  const workspaceWeatherOptions = ref<string[]>([])
  const workspaceTags = ref<string[]>([])
  const viewState = ref<ViewState>('loading')
  const rightPanel = ref<RightPanel>('journal')
  const editorMode = ref<EditorMode>('source')
  const editorContent = ref('')
  const savedContent = ref('')
  const frontmatter = ref<JournalFrontmatter | null>(null)
  const metadataDraft = ref<JournalEntryMetadata>(createEmptyMetadata())
  const savedMetadataSnapshot = ref(metadataToSnapshot(createEmptyMetadata()))
  const statusMessage = ref('')
  const metadataStatusMessage = ref('')
  const dailyInsightsStatusMessage = ref('')
  const themeSaveMessage = ref('')
  const windowZoomFactorSaveMessage = ref('')
  const heatmapSaveMessage = ref('')
  const dayStartHourSaveMessage = ref('')
  const notificationSaveMessage = ref('')
  const frontmatterVisibilitySaveMessage = ref('')
  const windowCloseBehaviorSaveMessage = ref('')
  const launchOnStartupSaveMessage = ref('')
  const workspaceLibrariesSaveMessage = ref('')
  const aiSaveMessage = ref('')
  const supplementSaveMessage = ref('')
  const mcpSaveMessage = ref('')
  const isCreatingEntry = ref(false)
  const isSavingEntry = ref(false)
  const isSavingMetadata = ref(false)
  const isGeneratingDailyInsights = ref(false)
  const isSavingTheme = ref(false)
  const isSavingWindowZoomFactor = ref(false)
  const isSavingJournalHeatmap = ref(false)
  const isSavingDayStartHour = ref(false)
  const isSavingNotification = ref(false)
  const isSavingFrontmatterVisibility = ref(false)
  const isSavingWindowCloseBehavior = ref(false)
  const isSavingLaunchOnStartup = ref(false)
  const isSavingWorkspaceLibraries = ref(false)
  const isSavingAiConfig = ref(false)
  const isSavingSupplement = ref(false)
  const isSavingMcp = ref(false)
  const isRebuildingProfile = ref(false)
  const isCancellingProfileRebuild = ref(false)
  const profileRebuildProgress = ref<UserProfileRebuildProgress | null>(null)
  const profileRebuildMessage = ref('')
  const isJournalHeatmapEnabled = ref(false)
  const theme = ref<AppTheme>('system')
  const windowZoomFactor = ref(1)
  const dayStartHour = ref(0)
  const timeTick = ref(0)
  const windowCloseBehavior = ref<WindowCloseBehavior>('tray')
  const launchOnStartupEnabled = ref(createDefaultLaunchOnStartupPreference())
  const notification = ref<NotificationConfig>(createDefaultNotificationConfig())
  const emailNotificationStatus = ref<EmailNotificationSecretStatus>(
    createDefaultEmailNotificationStatus(),
  )
  const frontmatterVisibility = ref<FrontmatterVisibilityConfig>(
    createDefaultFrontmatterVisibility(),
  )
  const aiSettingsStatus = ref<AiSettingsStatus>(createDefaultAiSettingsStatus())
  const supplementDocument = ref<SupplementDocument>(createDefaultSupplementDocument())
  const mcpEnabled = ref(false)
  const mcpPort = ref(9123)
  const mcpRuntimeStatus = ref<McpRuntimeStatus>(createDefaultMcpRuntimeStatus())
  const lastSavedAt = ref<string | null>(null)
  const activeSettingsSectionId = ref<SettingsSectionId>('appearance')
  const isReportExportMode =
    new URLSearchParams(window.location.search).get('mode') === 'report-export'

  const todayText = computed(() => {
    void timeTick.value
    return getJournalDateText(dayStartHour.value)
  })
  const selectedDateText = computed(() =>
    dayjs(selectedDate.value).format('YYYY 年 M 月 D 日 dddd'),
  )
  const isSelectedDateToday = computed(() => selectedDate.value === todayText.value)
  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const isBodyDirty = computed(
    () => viewState.value === 'ready' && editorContent.value !== savedContent.value,
  )
  const isMetadataDirty = computed(
    () =>
      viewState.value === 'ready' &&
      metadataToSnapshot(metadataDraft.value) !== savedMetadataSnapshot.value,
  )
  const isDirty = computed(() => isBodyDirty.value || isMetadataDirty.value)

  function updateTimeTick() {
    timeTick.value++
  }

  const canCreateEntry = computed(
    () =>
      hasWorkspace.value &&
      (viewState.value === 'today-empty' || viewState.value === 'history-empty') &&
      !isCreatingEntry.value,
  )
  const isJournalReady = computed(() => viewState.value === 'ready')
  const canSaveEntry = computed(
    () =>
      viewState.value === 'ready' &&
      isBodyDirty.value &&
      !isSavingEntry.value &&
      !isGeneratingDailyInsights.value,
  )
  const canSaveMetadata = computed(
    () =>
      viewState.value === 'ready' &&
      isMetadataDirty.value &&
      !isSavingMetadata.value &&
      !isGeneratingDailyInsights.value,
  )
  const canGenerateDailyInsights = computed(
    () =>
      viewState.value === 'ready' &&
      Boolean(editorContent.value.trim()) &&
      aiSettingsStatus.value.isConfigured &&
      !isSavingMetadata.value &&
      !isGeneratingDailyInsights.value,
  )
  const hasVisibleMetadataFields = computed(
    () =>
      frontmatterVisibility.value.weather ||
      frontmatterVisibility.value.location ||
      frontmatterVisibility.value.mood ||
      frontmatterVisibility.value.summary ||
      frontmatterVisibility.value.tags,
  )
  const saveMetaText = computed(() => {
    if (viewState.value !== 'ready') {
      return ''
    }

    if (isSavingEntry.value || isSavingMetadata.value) {
      return '正在保存...'
    }

    if (isGeneratingDailyInsights.value) {
      return '大模型整理中...'
    }

    if (isDirty.value) {
      return '未保存'
    }

    if (lastSavedAt.value) {
      return `已保存于 ${dayjs(lastSavedAt.value).format('HH:mm:ss')}`
    }

    return ''
  })

  return {
    activeSettingsSectionId,
    aiSaveMessage,
    aiSettingsStatus,
    canCreateEntry,
    canGenerateDailyInsights,
    canSaveEntry,
    canSaveMetadata,
    dailyInsightsStatusMessage,
    dayStartHour,
    dayStartHourSaveMessage,
    editorContent,
    editorMode,
    emailNotificationStatus,
    frontmatter,
    frontmatterVisibility,
    frontmatterVisibilitySaveMessage,
    hasVisibleMetadataFields,
    heatmapSaveMessage,
    isCreatingEntry,
    isCancellingProfileRebuild,
    isDirty,
    isGeneratingDailyInsights,
    isJournalHeatmapEnabled,
    isJournalReady,
    isRebuildingProfile,
    isReportExportMode,
    isSavingAiConfig,
    isSavingDayStartHour,
    isSavingEntry,
    isSavingFrontmatterVisibility,
    isSavingJournalHeatmap,
    isSavingLaunchOnStartup,
    isSavingMcp,
    isSavingMetadata,
    isSavingNotification,
    isSavingSupplement,
    isSavingTheme,
    isSavingWindowCloseBehavior,
    isSavingWindowZoomFactor,
    isSavingWorkspaceLibraries,
    isSelectedDateToday,
    lastSavedAt,
    launchOnStartupEnabled,
    launchOnStartupSaveMessage,
    mcpEnabled,
    mcpPort,
    mcpRuntimeStatus,
    mcpSaveMessage,
    metadataDraft,
    metadataStatusMessage,
    notification,
    notificationSaveMessage,
    profileRebuildMessage,
    profileRebuildProgress,
    rightPanel,
    saveMetaText,
    savedContent,
    savedMetadataSnapshot,
    selectedDate,
    selectedDateText,
    statusMessage,
    supplementDocument,
    supplementSaveMessage,
    theme,
    themeSaveMessage,
    todayText,
    updateTimeTick,
    viewState,
    windowCloseBehavior,
    windowCloseBehaviorSaveMessage,
    windowZoomFactor,
    windowZoomFactorSaveMessage,
    workspaceLibrariesSaveMessage,
    workspaceLocationOptions,
    workspacePath,
    workspaceTags,
    workspaceWeatherOptions,
  }
}

export type AppShellState = ReturnType<typeof useAppShellState>
