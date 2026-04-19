import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type {
  AiContextDocument,
  AiSettings,
  AiSettingsStatus,
  AppConfig,
  FrontmatterVisibilityConfig,
  JournalEntryMetadata,
  JournalEntryReadResult,
  JournalFrontmatter,
  WorkspaceSelectionResult,
} from '../types/dairy'
import type { EditorMode, RightPanel, ViewState } from '../types/ui'
import { useReportsPanel } from '../components/report/useReportsPanel'
import type { SettingsSectionId } from '../components/settings/config'
import { formatWindowZoomPercent } from '../shared/window-zoom'

function createDefaultFrontmatterVisibility(): FrontmatterVisibilityConfig {
  return {
    weather: true,
    location: true,
    mood: true,
    summary: true,
    tags: true,
  }
}

function createDefaultAiSettingsStatus(): AiSettingsStatus {
  return {
    settings: {
      providerType: 'openai-compatible',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      timeoutMs: 30000,
    },
    hasApiKey: false,
    isConfigured: false,
  }
}

function createDefaultAiContextDocument(): AiContextDocument {
  return {
    content: '',
  }
}

function normalizeStringList(values: string[]) {
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

function createEmptyMetadata(): JournalEntryMetadata {
  return {
    weather: '',
    location: '',
    mood: 0,
    summary: '',
    tags: [],
  }
}

function cloneMetadata(metadata: JournalEntryMetadata): JournalEntryMetadata {
  return {
    weather: metadata.weather,
    location: metadata.location,
    mood: metadata.mood,
    summary: metadata.summary,
    tags: [...metadata.tags],
  }
}

function normalizeMetadata(metadata: JournalEntryMetadata): JournalEntryMetadata {
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

function metadataToSnapshot(metadata: JournalEntryMetadata) {
  return JSON.stringify(normalizeMetadata(metadata))
}

function frontmatterToMetadata(frontmatter: JournalFrontmatter): JournalEntryMetadata {
  return {
    weather: frontmatter.weather,
    location: frontmatter.location,
    mood: frontmatter.mood,
    summary: frontmatter.summary,
    tags: [...frontmatter.tags],
  }
}

function getJournalDateText(hour: number, baseDate = dayjs()) {
  return baseDate.subtract(hour, 'hour').format('YYYY-MM-DD')
}

export function useAppShell() {
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
  const windowZoomFactorSaveMessage = ref('')
  const heatmapSaveMessage = ref('')
  const dayStartHourSaveMessage = ref('')
  const frontmatterVisibilitySaveMessage = ref('')
  const workspaceLibrariesSaveMessage = ref('')
  const aiSaveMessage = ref('')
  const aiContextSaveMessage = ref('')
  const isCreatingEntry = ref(false)
  const isSavingEntry = ref(false)
  const isSavingMetadata = ref(false)
  const isGeneratingDailyInsights = ref(false)
  const isSavingWindowZoomFactor = ref(false)
  const isSavingJournalHeatmap = ref(false)
  const isSavingDayStartHour = ref(false)
  const isSavingFrontmatterVisibility = ref(false)
  const isSavingWorkspaceLibraries = ref(false)
  const isSavingAiConfig = ref(false)
  const isSavingAiContext = ref(false)
  const isJournalHeatmapEnabled = ref(false)
  const windowZoomFactor = ref(1)
  const dayStartHour = ref(0)
  const frontmatterVisibility = ref<FrontmatterVisibilityConfig>(
    createDefaultFrontmatterVisibility(),
  )
  const aiSettingsStatus = ref<AiSettingsStatus>(createDefaultAiSettingsStatus())
  const aiContextDocument = ref<AiContextDocument>(createDefaultAiContextDocument())
  const lastSavedAt = ref<string | null>(null)
  const activeSettingsSectionId = ref<SettingsSectionId>('appearance')
  let loadSequence = 0
  let removeWindowZoomListener: (() => void) | null = null
  const isReportExportMode =
    new URLSearchParams(window.location.search).get('mode') === 'report-export'
  const reportsPanel = useReportsPanel(workspacePath)

  const todayText = computed(() => getJournalDateText(dayStartHour.value))
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

  watch(
    isDirty,
    (value) => {
      if (isReportExportMode) {
        return
      }

      void window.dairy.setWindowDirtyState({ isDirty: value })
    },
    { immediate: true },
  )

  onMounted(async () => {
    if (isReportExportMode) {
      return
    }

    removeWindowZoomListener = window.dairy.onWindowZoomFactorChanged((nextZoomFactor) => {
      windowZoomFactor.value = nextZoomFactor
    })
    window.addEventListener('keydown', handleWindowKeydown)
    await bootstrapApp()
  })

  onBeforeUnmount(() => {
    if (isReportExportMode) {
      return
    }

    removeWindowZoomListener?.()
    removeWindowZoomListener = null
    window.removeEventListener('keydown', handleWindowKeydown)
  })

  async function bootstrapApp() {
    resetTransientState()
    viewState.value = 'loading'

    try {
      const [bootstrap, nextAiSettingsStatus, nextAiContextDocument] = await Promise.all([
        window.dairy.getAppBootstrap(),
        window.dairy.getAiSettingsStatus(),
        window.dairy.getAiContext(),
      ])

      syncConfigState(bootstrap.config)
      aiSettingsStatus.value = nextAiSettingsStatus
      aiContextDocument.value = nextAiContextDocument
      selectedDate.value = todayText.value

      if (!workspacePath.value) {
        workspaceLocationOptions.value = []
        workspaceWeatherOptions.value = []
        workspaceTags.value = []
        applyNoWorkspaceState()
        return
      }

      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
        loadEntryForDate(selectedDate.value),
      ])
    } catch (error) {
      applyErrorState(error)
    }
  }

  function syncConfigState(config: AppConfig) {
    workspacePath.value = config.lastOpenedWorkspace
    windowZoomFactor.value = config.ui.zoomFactor
    isJournalHeatmapEnabled.value = config.ui.journalHeatmapEnabled
    dayStartHour.value = config.ui.dayStartHour
    frontmatterVisibility.value = {
      ...config.ui.frontmatterVisibility,
    }
  }

  function resetTransientState() {
    editorContent.value = ''
    savedContent.value = ''
    frontmatter.value = null
    metadataDraft.value = createEmptyMetadata()
    savedMetadataSnapshot.value = metadataToSnapshot(createEmptyMetadata())
    statusMessage.value = ''
    metadataStatusMessage.value = ''
    dailyInsightsStatusMessage.value = ''
    lastSavedAt.value = null
  }

  function getDateRelation(dateText: string) {
    const currentDate = dayjs(dateText)
    const todayDate = dayjs(todayText.value)

    if (currentDate.isSame(todayDate, 'day')) {
      return 'today'
    }

    return currentDate.isBefore(todayDate, 'day') ? 'past' : 'future'
  }

  function applyNoWorkspaceState() {
    resetTransientState()
    viewState.value = 'no-workspace'
  }

  function applyMissingEntryState(dateText: string) {
    resetTransientState()

    const relation = getDateRelation(dateText)
    if (relation === 'today') {
      viewState.value = 'today-empty'
      return
    }

    if (relation === 'future') {
      viewState.value = 'future-empty'
      return
    }

    viewState.value = 'history-empty'
  }

  function applyReadyState(entry: JournalEntryReadResult) {
    if (entry.status !== 'ready' || !entry.frontmatter) {
      return
    }

    const nextMetadata = frontmatterToMetadata(entry.frontmatter)

    viewState.value = 'ready'
    editorContent.value = entry.body ?? ''
    savedContent.value = entry.body ?? ''
    frontmatter.value = entry.frontmatter
    metadataDraft.value = cloneMetadata(nextMetadata)
    savedMetadataSnapshot.value = metadataToSnapshot(nextMetadata)
    statusMessage.value = ''
    metadataStatusMessage.value = ''
    dailyInsightsStatusMessage.value = ''
    lastSavedAt.value = entry.frontmatter.updatedAt
  }

  function applyErrorState(error: unknown) {
    resetTransientState()
    viewState.value = 'error'
    statusMessage.value = error instanceof Error ? error.message : '读取数据时发生未知错误。'
  }

  async function confirmDiscardChanges() {
    if (!isDirty.value) {
      return true
    }

    return window.confirm('当前内容还没有保存，继续切换会丢失修改。要继续吗？')
  }

  async function loadWorkspaceTags() {
    if (!workspacePath.value) {
      workspaceTags.value = []
      return
    }

    try {
      workspaceTags.value = await window.dairy.getWorkspaceTags(workspacePath.value)
    } catch {
      workspaceTags.value = []
    }
  }

  async function loadWorkspaceWeatherOptions() {
    if (!workspacePath.value) {
      workspaceWeatherOptions.value = []
      return
    }

    try {
      workspaceWeatherOptions.value = await window.dairy.getWorkspaceWeatherOptions(
        workspacePath.value,
      )
    } catch {
      workspaceWeatherOptions.value = []
    }
  }

  async function loadWorkspaceLocationOptions() {
    if (!workspacePath.value) {
      workspaceLocationOptions.value = []
      return
    }

    try {
      workspaceLocationOptions.value = await window.dairy.getWorkspaceLocationOptions(
        workspacePath.value,
      )
    } catch {
      workspaceLocationOptions.value = []
    }
  }

  async function handleSelectDate(nextDate: string) {
    if (nextDate === selectedDate.value) {
      return
    }

    if (!(await confirmDiscardChanges())) {
      return
    }

    selectedDate.value = nextDate
    rightPanel.value = 'journal'

    if (!workspacePath.value) {
      applyNoWorkspaceState()
      return
    }

    await loadEntryForDate(nextDate)
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
      selectedDate.value = todayText.value
      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
        loadEntryForDate(selectedDate.value),
      ])
    } catch (error) {
      applyErrorState(error)
    }
  }

  function applyWorkspaceSelection(result: WorkspaceSelectionResult) {
    syncConfigState(result.config)
    workspacePath.value = result.workspacePath
  }

  async function loadEntryForDate(dateText: string) {
    if (!workspacePath.value) {
      applyNoWorkspaceState()
      return
    }

    const currentLoad = ++loadSequence
    const shouldShowLoadingState =
      viewState.value === 'loading' ||
      viewState.value === 'error' ||
      viewState.value === 'no-workspace'

    if (shouldShowLoadingState) {
      viewState.value = 'loading'
    }

    statusMessage.value = ''
    metadataStatusMessage.value = ''
    dailyInsightsStatusMessage.value = ''

    try {
      const result = await window.dairy.readJournalEntry({
        workspacePath: workspacePath.value,
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
    if (!workspacePath.value || !canCreateEntry.value) {
      return
    }

    isCreatingEntry.value = true

    try {
      const result = await window.dairy.createJournalEntry({
        workspacePath: workspacePath.value,
        date: selectedDate.value,
      })

      applyReadyState(result)
      await Promise.all([
        loadWorkspaceLocationOptions(),
        loadWorkspaceWeatherOptions(),
        loadWorkspaceTags(),
      ])
      statusMessage.value = isSelectedDateToday.value
        ? '已经创建今天的日记，可以开始写了。'
        : `已经创建 ${selectedDateText.value} 的日记，可以开始补写了。`
    } catch (error) {
      applyErrorState(error)
    } finally {
      isCreatingEntry.value = false
    }
  }

  async function handleSaveEntry() {
    if (!workspacePath.value || viewState.value !== 'ready' || !isBodyDirty.value) {
      return
    }

    isSavingEntry.value = true

    try {
      const result = await window.dairy.saveJournalEntryBody({
        workspacePath: workspacePath.value,
        date: selectedDate.value,
        body: editorContent.value,
      })

      savedContent.value = editorContent.value
      lastSavedAt.value = result.savedAt
      statusMessage.value = '正文已保存。'

      if (frontmatter.value) {
        frontmatter.value = {
          ...frontmatter.value,
          updatedAt: result.savedAt,
        }
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '保存正文失败，请稍后重试。'
    } finally {
      isSavingEntry.value = false
    }
  }

  async function handleSaveMetadata() {
    if (!workspacePath.value || viewState.value !== 'ready' || !isMetadataDirty.value) {
      return
    }

    isSavingMetadata.value = true

    try {
      const normalizedMetadata = normalizeMetadata(metadataDraft.value)
      const result = await window.dairy.saveJournalEntryMetadata({
        workspacePath: workspacePath.value,
        date: selectedDate.value,
        metadata: normalizedMetadata,
      })

      metadataDraft.value = cloneMetadata(normalizedMetadata)
      savedMetadataSnapshot.value = metadataToSnapshot(normalizedMetadata)
      lastSavedAt.value = result.savedAt
      metadataStatusMessage.value = '日记信息已保存。'

      if (frontmatter.value) {
        frontmatter.value = {
          ...frontmatter.value,
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
      metadataStatusMessage.value =
        error instanceof Error ? error.message : '保存日记信息失败，请稍后重试。'
    } finally {
      isSavingMetadata.value = false
    }
  }

  async function handleGenerateDailyInsights() {
    if (!workspacePath.value || viewState.value !== 'ready') {
      return
    }

    if (!editorContent.value.trim()) {
      dailyInsightsStatusMessage.value = '正文为空，暂时无法自动整理。'
      return
    }

    if (!aiSettingsStatus.value.isConfigured) {
      dailyInsightsStatusMessage.value = '请先在设置页完成大模型配置和 API Key 保存。'
      return
    }

    if (
      metadataDraft.value.summary.trim() ||
      metadataDraft.value.tags.length > 0 ||
      metadataDraft.value.mood !== 0
    ) {
      const shouldContinue = window.confirm(
        '自动整理会覆盖当前的一句话总结、标签和心情，是否继续？',
      )
      if (!shouldContinue) {
        return
      }
    }

    isGeneratingDailyInsights.value = true
    dailyInsightsStatusMessage.value = ''

    try {
      const result = await window.dairy.generateDailyInsights({
        workspacePath: `${workspacePath.value}`,
        date: `${selectedDate.value}`,
        body: `${editorContent.value}`,
        workspaceTags: [...workspaceTags.value],
      })

      metadataDraft.value = cloneMetadata({
        ...metadataDraft.value,
        mood: result.mood,
        summary: result.summary,
        tags: result.tags,
      })

      dailyInsightsStatusMessage.value =
        result.newTags.length > 0
          ? `已生成总结、标签和心情。保存信息后会新增 ${result.newTags.length} 个候选标签。`
          : '已生成总结、标签和心情。'
    } catch (error) {
      dailyInsightsStatusMessage.value =
        error instanceof Error ? error.message : '自动整理失败，请稍后重试。'
    } finally {
      isGeneratingDailyInsights.value = false
    }
  }

  async function handleSaveAll() {
    if (!workspacePath.value || viewState.value !== 'ready') {
      return
    }

    if (isSavingEntry.value || isSavingMetadata.value || isGeneratingDailyInsights.value) {
      return
    }

    if (isMetadataDirty.value) {
      await handleSaveMetadata()
    }

    if (isBodyDirty.value) {
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
    metadataDraft.value = cloneMetadata({
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
    metadataStatusMessage.value = ''
    dailyInsightsStatusMessage.value = ''
  }

  function setEditorMode(mode: EditorMode) {
    editorMode.value = mode
  }

  function openSettingsPage() {
    rightPanel.value = 'settings'
  }

  function openReportsPage() {
    rightPanel.value = 'reports'
  }

  function openJournalPage() {
    rightPanel.value = 'journal'
  }

  async function handleUpdateJournalHeatmapEnabled(nextValue: boolean) {
    isSavingJournalHeatmap.value = true
    heatmapSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setJournalHeatmapEnabled({
        enabled: nextValue,
      })

      syncConfigState(nextConfig)
      heatmapSaveMessage.value = nextValue ? '已开启字数热力图。' : '已关闭字数热力图。'
    } catch (error) {
      heatmapSaveMessage.value =
        error instanceof Error ? error.message : '保存显示设置失败，请稍后重试。'
    } finally {
      isSavingJournalHeatmap.value = false
    }
  }

  async function handleUpdateWindowZoomFactor(nextValue: number) {
    isSavingWindowZoomFactor.value = true
    windowZoomFactorSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setWindowZoomFactor({
        zoomFactor: nextValue,
      })

      syncConfigState(nextConfig)
      windowZoomFactorSaveMessage.value = `界面缩放已调整为 ${formatWindowZoomPercent(
        nextConfig.ui.zoomFactor,
      )}。`
    } catch (error) {
      windowZoomFactorSaveMessage.value =
        error instanceof Error ? error.message : '保存界面缩放失败，请稍后重试。'
    } finally {
      isSavingWindowZoomFactor.value = false
    }
  }

  async function handleUpdateDayStartHour(nextValue: number) {
    const wasSelectedToday = isSelectedDateToday.value
    isSavingDayStartHour.value = true
    dayStartHourSaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setDayStartHour({
        hour: nextValue,
      })

      syncConfigState(nextConfig)

      if (wasSelectedToday) {
        selectedDate.value = todayText.value
      }

      if (workspacePath.value) {
        await loadEntryForDate(selectedDate.value)
      } else {
        applyNoWorkspaceState()
      }

      dayStartHourSaveMessage.value = '新一天开始时间已保存。'
    } catch (error) {
      dayStartHourSaveMessage.value =
        error instanceof Error ? error.message : '保存新一天开始时间失败，请稍后重试。'
    } finally {
      isSavingDayStartHour.value = false
    }
  }

  async function handleUpdateFrontmatterVisibility(
    nextVisibility: FrontmatterVisibilityConfig,
  ) {
    isSavingFrontmatterVisibility.value = true
    frontmatterVisibilitySaveMessage.value = ''

    try {
      const nextConfig = await window.dairy.setFrontmatterVisibility({
        visibility: nextVisibility,
      })

      syncConfigState(nextConfig)
      frontmatterVisibilitySaveMessage.value = '日记信息展示设置已保存。'
    } catch (error) {
      frontmatterVisibilitySaveMessage.value =
        error instanceof Error ? error.message : '保存日记信息展示设置失败，请稍后重试。'
    } finally {
      isSavingFrontmatterVisibility.value = false
    }
  }

  async function handleSaveWorkspaceLibraries(input: {
    tags: string[]
    weatherOptions: string[]
    locationOptions: string[]
  }) {
    if (!workspacePath.value) {
      return
    }

    isSavingWorkspaceLibraries.value = true
    workspaceLibrariesSaveMessage.value = ''

    try {
      const normalizedTags = normalizeStringList(input.tags)
      const normalizedWeatherOptions = normalizeStringList(input.weatherOptions)
      const normalizedLocationOptions = normalizeStringList(input.locationOptions)

      const [nextTags, nextWeatherOptions, nextLocationOptions] = await Promise.all([
        window.dairy.setWorkspaceTags({
          workspacePath: workspacePath.value,
          items: normalizedTags,
        }),
        window.dairy.setWorkspaceWeatherOptions({
          workspacePath: workspacePath.value,
          items: normalizedWeatherOptions,
        }),
        window.dairy.setWorkspaceLocationOptions({
          workspacePath: workspacePath.value,
          items: normalizedLocationOptions,
        }),
      ])

      workspaceTags.value = nextTags
      workspaceWeatherOptions.value = nextWeatherOptions
      workspaceLocationOptions.value = nextLocationOptions
      workspaceLibrariesSaveMessage.value = '候选词库已保存。'
    } catch (error) {
      workspaceLibrariesSaveMessage.value =
        error instanceof Error ? error.message : '保存候选词库失败，请稍后重试。'
    } finally {
      isSavingWorkspaceLibraries.value = false
    }
  }

  async function handleSaveAiConfiguration(
    input: AiSettings & {
      apiKey: string
    },
  ) {
    isSavingAiConfig.value = true
    aiSaveMessage.value = ''

    try {
      const settingsStatus = await window.dairy.saveAiSettings({
        providerType: input.providerType,
        baseURL: input.baseURL,
        model: input.model,
        timeoutMs: input.timeoutMs,
      })
      aiSettingsStatus.value = settingsStatus

      const apiKey = input.apiKey.trim()
      if (!apiKey) {
        aiSaveMessage.value = '大模型配置已保存。'
        return
      }

      try {
        const nextStatus = await window.dairy.saveAiApiKey({
          providerType: input.providerType,
          apiKey,
        })
        aiSettingsStatus.value = nextStatus
        aiSaveMessage.value = '大模型配置和 API Key 已保存。'
      } catch (error) {
        aiSaveMessage.value = `大模型配置已保存，但 API Key 保存失败：${
          error instanceof Error ? error.message : '请稍后重试。'
        }`
      }
    } catch (error) {
      aiSaveMessage.value =
        error instanceof Error ? error.message : '保存大模型配置失败，请稍后重试。'
    } finally {
      isSavingAiConfig.value = false
    }
  }

  async function handleSaveAiContext(content: string) {
    isSavingAiContext.value = true
    aiContextSaveMessage.value = ''

    try {
      const nextDocument = await window.dairy.saveAiContext({ content })
      aiContextDocument.value = nextDocument
      aiContextSaveMessage.value = '补充知识已保存。'
    } catch (error) {
      aiContextSaveMessage.value =
        error instanceof Error ? error.message : '保存补充知识失败，请稍后重试。'
    } finally {
      isSavingAiContext.value = false
    }
  }

  return {
    activeSettingsSectionId,
    aiContextDocument,
    aiContextSaveMessage,
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
    frontmatter,
    frontmatterVisibility,
    frontmatterVisibilitySaveMessage,
    handleChooseWorkspace,
    handleCreateEntry,
    handleGenerateDailyInsights,
    handleSaveAiConfiguration,
    handleSaveAiContext,
    handleSaveAll,
    handleSaveEntry,
    handleSaveMetadata,
    handleSaveWorkspaceLibraries,
    handleSelectDate,
    handleUpdateDayStartHour,
    handleUpdateFrontmatterVisibility,
    handleUpdateJournalHeatmapEnabled,
    handleUpdateMetadata,
    handleUpdateWindowZoomFactor,
    hasVisibleMetadataFields,
    heatmapSaveMessage,
    isCreatingEntry,
    isDirty,
    isGeneratingDailyInsights,
    isJournalHeatmapEnabled,
    isJournalReady,
    isReportExportMode,
    isSavingAiConfig,
    isSavingAiContext,
    isSavingDayStartHour,
    isSavingEntry,
    isSavingJournalHeatmap,
    isSavingMetadata,
    isSavingWindowZoomFactor,
    isSavingWorkspaceLibraries,
    isSavingFrontmatterVisibility,
    loadEntryForDate,
    metadataDraft,
    metadataStatusMessage,
    openJournalPage,
    openReportsPage,
    openSettingsPage,
    reportsPanel,
    rightPanel,
    saveMetaText,
    selectedDate,
    selectedDateText,
    setEditorMode,
    statusMessage,
    todayText,
    viewState,
    windowZoomFactor,
    windowZoomFactorSaveMessage,
    workspaceLibrariesSaveMessage,
    workspaceLocationOptions,
    workspacePath,
    workspaceTags,
    workspaceWeatherOptions,
    isSelectedDateToday,
  }
}
