<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import JournalHeader from './components/JournalHeader.vue'
import SettingsHeader from './components/SettingsHeader.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import JournalEditorPanel from './components/JournalEditorPanel.vue'
import type {
  AppConfig,
  JournalEntryReadResult,
  WorkspaceSelectionResult,
} from './types/dairy'
import type { EditorMode, RightPanel, ViewState } from './types/ui'

const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const workspacePath = ref<string | null>(null)
const viewState = ref<ViewState>('loading')
const rightPanel = ref<RightPanel>('journal')
const editorMode = ref<EditorMode>('source')
const editorContent = ref('')
const savedContent = ref('')
const statusMessage = ref('')
const isCreatingEntry = ref(false)
const isSavingEntry = ref(false)
const lastSavedAt = ref<string | null>(null)
let loadSequence = 0

const todayText = computed(() => dayjs().format('YYYY-MM-DD'))
const selectedDateText = computed(() => dayjs(selectedDate.value).format('YYYY 年 M 月 D 日 dddd'))
const hasWorkspace = computed(() => Boolean(workspacePath.value))
const isDirty = computed(() => viewState.value === 'ready' && editorContent.value !== savedContent.value)
const canCreateTodayEntry = computed(
  () => hasWorkspace.value && viewState.value === 'today-empty' && !isCreatingEntry.value,
)
const isJournalReady = computed(() => viewState.value === 'ready')
const saveMetaText = computed(() => {
  if (viewState.value !== 'ready') {
    return ''
  }

  if (isSavingEntry.value) {
    return '正在保存...'
  }

  if (isDirty.value) {
    return '未保存'
  }

  if (lastSavedAt.value) {
    return `已保存于 ${dayjs(lastSavedAt.value).format('HH:mm:ss')}`
  }

  return ''
})

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  await bootstrapApp()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

async function bootstrapApp() {
  resetTransientState()
  viewState.value = 'loading'

  try {
    const bootstrap = await window.dairy.getAppBootstrap()
    syncConfigState(bootstrap.config)

    if (!workspacePath.value) {
      applyNoWorkspaceState()
      return
    }

    await loadEntryForDate(selectedDate.value)
  } catch (error) {
    applyErrorState(error)
  }
}

function syncConfigState(config: AppConfig) {
  workspacePath.value = config.lastOpenedWorkspace
}

function resetTransientState() {
  editorContent.value = ''
  savedContent.value = ''
  statusMessage.value = ''
  lastSavedAt.value = null
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) {
    return
  }

  event.preventDefault()
  event.returnValue = ''
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
  viewState.value = 'ready'
  editorContent.value = entry.content ?? ''
  savedContent.value = entry.content ?? ''
  statusMessage.value = ''
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
    await loadEntryForDate(selectedDate.value)
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
  viewState.value = 'loading'
  statusMessage.value = ''

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
  if (!workspacePath.value || !canCreateTodayEntry.value) {
    return
  }

  isCreatingEntry.value = true

  try {
    const result = await window.dairy.createJournalEntry({
      workspacePath: workspacePath.value,
      date: selectedDate.value,
    })

    applyReadyState(result)
    statusMessage.value = '已经创建今天的日记，可以开始写了。'
  } catch (error) {
    applyErrorState(error)
  } finally {
    isCreatingEntry.value = false
  }
}

async function handleSaveEntry() {
  if (!workspacePath.value || viewState.value !== 'ready' || !isDirty.value) {
    return
  }

  isSavingEntry.value = true

  try {
    const result = await window.dairy.saveJournalEntry({
      workspacePath: workspacePath.value,
      date: selectedDate.value,
      content: editorContent.value,
    })

    savedContent.value = editorContent.value
    lastSavedAt.value = result.savedAt
    statusMessage.value = '保存成功。'
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  } finally {
    isSavingEntry.value = false
  }
}

function setEditorMode(mode: EditorMode) {
  editorMode.value = mode
}

function openSettingsPage() {
  rightPanel.value = 'settings'
}

function openJournalPage() {
  rightPanel.value = 'journal'
}
</script>

<template>
  <div class="app-shell">
    <WorkspaceSidebar
      :workspace-path="workspacePath"
      :selected-date="selectedDate"
      @choose-workspace="handleChooseWorkspace"
      @open-settings="openSettingsPage"
      @select-date="handleSelectDate"
    />

    <main class="editor-shell">
      <JournalHeader
        v-if="rightPanel === 'journal'"
        :selected-date-text="selectedDateText"
        :is-dirty="isDirty"
        :save-meta-text="saveMetaText"
        :editor-mode="editorMode"
        :is-journal-ready="isJournalReady"
        @update:editor-mode="setEditorMode"
      />

      <SettingsHeader
        v-else
        @back="openJournalPage"
      />

      <SettingsPanel
        v-if="rightPanel === 'settings'"
        :workspace-path="workspacePath"
      />

      <JournalEditorPanel
        v-else
        :view-state="viewState"
        :editor-mode="editorMode"
        :editor-content="editorContent"
        :status-message="statusMessage"
        :is-creating-entry="isCreatingEntry"
        @update:editor-content="editorContent = $event"
        @create-entry="handleCreateEntry"
        @choose-workspace="handleChooseWorkspace"
        @reload-entry="loadEntryForDate(selectedDate)"
        @save-shortcut="handleSaveEntry"
      />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
}

.editor-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  padding: 2rem;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .editor-shell {
    padding: 1.2rem;
  }
}
</style>
