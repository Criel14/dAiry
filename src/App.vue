<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import JournalCalendar from './components/JournalCalendar.vue'
import type {
  AppConfig,
  JournalEntryReadResult,
  WorkspaceSelectionResult,
} from './types/dairy'

type ViewState =
  | 'no-workspace'
  | 'loading'
  | 'ready'
  | 'today-empty'
  | 'history-empty'
  | 'future-empty'
  | 'error'

type RightPanel = 'journal' | 'settings'

// 主页不走复杂状态库，先用明确的视图状态把页面分支管理清楚，
// 这样后面继续加 Markdown、设置页或 AI 面板时不容易相互打架。
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const workspacePath = ref<string | null>(null)
const viewState = ref<ViewState>('loading')
const rightPanel = ref<RightPanel>('journal')
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
const canSave = computed(() => viewState.value === 'ready' && isDirty.value && !isSavingEntry.value)
const canCreateTodayEntry = computed(
  () => hasWorkspace.value && viewState.value === 'today-empty' && !isCreatingEntry.value,
)
const saveMetaText = computed(() => {
  if (viewState.value !== 'ready') {
    return ''
  }

  if (isSavingEntry.value) {
    return '正在保存...'
  }

  if (isDirty.value) {
    return '尚未保存'
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
    // 首次进入时只做两件事：
    // 1. 从主进程恢复应用配置
    // 2. 如果已有工作区，就直接读取当前日期对应的日记
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

  // 使用浏览器级拦截，避免窗口关闭时悄悄丢失未保存内容。
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

function applyMissingEntryState(dateText: string, _targetFilePath: string) {
  resetTransientState()

  // 缺失文件时根据日期和“今天”的关系决定页面行为：
  // 今天：允许新建
  // 历史：只读提示
  // 未来：提示暂不创建
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

  // 切换日期、切换目录前统一走这一层，避免未保存保护逻辑散落在各处。
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

  // 通过递增序号丢弃过期请求，避免用户快速切换日期时旧结果覆盖新结果。
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
      applyMissingEntryState(dateText, result.filePath)
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

function handleEditorKeydown(event: KeyboardEvent) {
  // 先保留桌面编辑器最基础的快捷键体验。
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void handleSaveEntry()
  }
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
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="brand-block">
          <p class="brand-kicker">Local Writing Space</p>
          <h1 class="brand-title">dAiry</h1>
          <p class="brand-subtitle">把写日记这件事先变得顺手，再慢慢加入 AI 帮助。</p>
        </div>

        <section class="workspace-card">
          <header class="workspace-header">
            <div class="workspace-copy">
              <span class="workspace-label">当前目录</span>
              <strong
                class="workspace-path"
                :title="workspacePath ?? '请选择一个目录开始记日记'"
              >
                {{ workspacePath ?? '请选择一个目录开始记日记' }}
              </strong>
            </div>

            <div class="workspace-actions">
              <button
                class="icon-button"
                type="button"
                title="打开或切换日记目录"
                @click="handleChooseWorkspace"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3.429a2.5 2.5 0 0 1 1.768.732l1.071 1.071a1.5 1.5 0 0 0 1.06.44H17.5A2.5 2.5 0 0 1 20 9.743V16.5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                  />
                </svg>
              </button>

              <button
                class="icon-button"
                type="button"
                title="打开设置"
                @click="openSettingsPage"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M10.74 3.305a1 1 0 0 1 1.52 0l.78.916a1 1 0 0 0 1.054.305l1.165-.32a1 1 0 0 1 1.3.78l.2 1.185a1 1 0 0 0 .75.81l1.17.283a1 1 0 0 1 .63 1.38l-.52 1.085a1 1 0 0 0 .09 1.093l.733.95a1 1 0 0 1-.23 1.5l-1.01.65a1 1 0 0 0-.45 1l.18 1.19a1 1 0 0 1-1.04 1.11l-1.204-.06a1 1 0 0 0-.93.585l-.514 1.09a1 1 0 0 1-1.46.4l-1.02-.63a1 1 0 0 0-1.105 0l-1.02.63a1 1 0 0 1-1.46-.4l-.514-1.09a1 1 0 0 0-.93-.585l-1.204.06a1 1 0 0 1-1.04-1.11l.18-1.19a1 1 0 0 0-.45-1l-1.01-.65a1 1 0 0 1-.23-1.5l.733-.95a1 1 0 0 0 .09-1.093l-.52-1.085a1 1 0 0 1 .63-1.38l1.17-.282a1 1 0 0 0 .75-.811l.2-1.185a1 1 0 0 1 1.3-.78l1.165.32a1 1 0 0 0 1.055-.305l.779-.916ZM12 9.25A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z"
                  />
                </svg>
              </button>
            </div>
          </header>
        </section>

        <JournalCalendar
          :model-value="selectedDate"
          @update:model-value="handleSelectDate"
        />
      </div>

    </aside>

    <main class="editor-shell">
      <header v-if="rightPanel === 'journal'" class="editor-header">
        <div class="editor-heading">
          <p class="editor-kicker">Journal</p>
          <h2 class="editor-title">{{ selectedDateText }}</h2>
        </div>

        <div class="editor-actions">
          <span class="save-meta">{{ saveMetaText }}</span>
          <button class="save-button" type="button" :disabled="!canSave" @click="handleSaveEntry">保存</button>
        </div>
      </header>

      <header v-else class="editor-header">
        <div class="editor-heading">
          <p class="editor-kicker">Settings</p>
          <h2 class="editor-title">设置</h2>
        </div>

        <div class="editor-actions">
          <button class="ghost-button" type="button" @click="openJournalPage">
            返回日记
          </button>
        </div>
      </header>

      <section v-if="rightPanel === 'settings'" class="settings-panel">
        <section class="settings-card">
          <span class="panel-label">工作区目录</span>
          <strong class="panel-value">{{ workspacePath ?? '还没有选择目录' }}</strong>
          <p class="panel-description">这里后续会逐步放入主题、模型、保存偏好等设置项。</p>
        </section>

        <section class="settings-card">
          <span class="panel-label">当前阶段</span>
          <strong class="panel-value">设置页骨架已接通</strong>
          <p class="panel-description">目前先保留最基础的入口和页面结构，便于后续继续扩展。</p>
        </section>
      </section>

      <section v-else-if="viewState === 'loading'" class="empty-state">
        <h3>正在加载这一天的内容</h3>
        <p>稍等一下，我正在读取对应的日记文件。</p>
      </section>

      <section v-else-if="viewState === 'no-workspace'" class="empty-state">
        <h3>请选择一个目录开始记录</h3>
        <p>先在左上角选择日记目录，dAiry 会在里面按年、月整理你的日记文件。</p>
        <button class="primary-button" type="button" @click="handleChooseWorkspace">
          选择目录
        </button>
      </section>

      <section v-else-if="viewState === 'today-empty'" class="empty-state">
        <h3>今天还没有写日记</h3>
        <p>可以先创建一个空白的 <code>.md</code> 文件，然后开始记录今天。</p>
        <button class="primary-button" type="button" :disabled="isCreatingEntry" @click="handleCreateEntry">
          {{ isCreatingEntry ? '正在创建...' : '新建日记' }}
        </button>
      </section>

      <section v-else-if="viewState === 'history-empty'" class="empty-state">
        <h3>这一天没有写日记呢</h3>
        <p>历史日期没有对应文件时，这里会保持只读状态，避免误操作。</p>
      </section>

      <section v-else-if="viewState === 'future-empty'" class="empty-state">
        <h3>这一天还没有到来</h3>
        <p>未来日期暂时不会自动创建日记，等到了当天再开始写会更自然一些。</p>
      </section>

      <section v-else-if="viewState === 'error'" class="empty-state empty-state--error">
        <h3>读取内容时出了点问题</h3>
        <p>{{ statusMessage }}</p>
        <button class="primary-button" type="button" @click="loadEntryForDate(selectedDate)">
          重新读取
        </button>
      </section>

      <section v-else class="editor-panel">
        <textarea
          v-model="editorContent"
          class="editor-textarea"
          placeholder="在这里开始写今天的内容吧..."
          spellcheck="false"
          @keydown="handleEditorKeydown"
        />
      </section>

      <footer v-if="rightPanel === 'journal'" class="editor-footer">
        <span class="editor-footer-tip">写下今日的心情与发生的故事</span>
        <span class="editor-footer-message">{{ statusMessage }}</span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 30% 70%;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 1.5rem;
  padding: 2rem 1.5rem;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  background: #fbfaf4;
}

.sidebar-top {
  display: grid;
  gap: 1.25rem;
}

.brand-block {
  display: grid;
  gap: 0.4rem;
}

.brand-kicker,
.editor-kicker,
.workspace-label,
.panel-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.brand-title,
.editor-title {
  margin: 0;
  color: var(--color-text-main);
}

.brand-title {
  font-size: 2.4rem;
}

.brand-subtitle,
.panel-description,
.editor-footer-tip,
.editor-footer-message,
.empty-state p {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.workspace-card,
.settings-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  box-shadow: none;
}

.workspace-header {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
  justify-content: space-between;
}

.workspace-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.workspace-path,
.panel-value {
  color: var(--color-text-main);
}

.workspace-path {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
}

.workspace-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-button,
.ghost-button,
.save-button,
.primary-button {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.icon-button:hover,
.ghost-button:hover,
.save-button:hover,
.primary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.45rem;
  height: 2.45rem;
  padding: 0;
  background: #fffdf8;
  color: var(--color-text-main);
}

.icon-button svg {
  width: 1.35rem;
  height: 1.35rem;
  fill: currentColor;
}

.editor-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  padding: 2rem;
  min-height: 0;
  overflow: hidden;
}

.editor-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.editor-heading {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.editor-title {
  font-size: 1.8rem;
}

.editor-actions {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: flex-end;
}

.save-meta {
  min-height: 1.2rem;
  font-size: 0.84rem;
  color: var(--color-text-soft);
}

.save-button,
.primary-button {
  min-height: 2.7rem;
  padding: 0 1.2rem;
  background: #f5ebc3;
  color: #4f4630;
}

.ghost-button {
  min-height: 2.4rem;
  padding: 0 1rem;
  background: #fffdf8;
  color: var(--color-text-main);
}

.save-button:disabled,
.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
  transform: none;
}

.editor-panel,
.empty-state,
.settings-panel {
  display: grid;
  align-content: stretch;
  min-height: 0;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  box-shadow: none;
  overflow: hidden;
}

.editor-panel {
  grid-template-rows: 1fr;
}

.empty-state {
  gap: 1rem;
  align-content: center;
  justify-items: start;
}

.settings-panel {
  gap: 1rem;
  align-content: start;
}

.empty-state h3 {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
}

.empty-state--error {
  border-color: #dbcfa3;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: 0;
  background: transparent;
  color: var(--color-text-main);
  font-size: 1.02rem;
  line-height: 1.9;
  outline: none;
  overflow-y: auto;
}

.editor-footer {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  min-height: 1.5rem;
  flex-wrap: wrap;
}

.editor-footer-message {
  color: var(--color-text-soft);
}

@media (max-width: 1180px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }
}

@media (max-width: 768px) {
  .sidebar,
  .editor-shell {
    padding: 1.2rem;
  }

  .editor-header,
  .editor-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-actions {
    align-items: stretch;
  }
}
</style>
