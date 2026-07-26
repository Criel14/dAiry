<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { EditorMode, ViewState } from '../../../../types/ui'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
})

const props = defineProps<{
  viewState: ViewState
  editorMode: EditorMode
  editorContent: string
  statusMessage: string
  isCreatingEntry: boolean
  isSelectedDateToday: boolean
}>()

const emit = defineEmits<{
  'update:editorContent': [value: string]
  createEntry: []
  chooseWorkspace: []
  reloadEntry: []
  saveShortcut: []
}>()

const editorContentModel = computed({
  get: () => props.editorContent,
  set: (value: string) => emit('update:editorContent', value),
})

const renderedMarkdown = computed(() => {
  if (props.viewState !== 'ready') {
    return ''
  }

  return markdown.render(props.editorContent)
})

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const totalWordCount = computed(() => {
  if (!props.editorContent.trim()) return 0
  return props.editorContent.replace(/\s+/g, '').length
})

const selectedWordCount = ref(0)

function updateSelection() {
  const ta = textareaRef.value
  if (!ta) {
    selectedWordCount.value = 0
    return
  }
  const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd)
  selectedWordCount.value = selected.replace(/\s+/g, '').length
}

watch(() => props.editorContent, () => {
  selectedWordCount.value = 0
})

function handleEditorKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('saveShortcut')
  }
}

function handlePreviewClick(event: MouseEvent) {
  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return
  }

  const link = target.closest('a')
  if (!link) {
    return
  }

  event.preventDefault()
}
</script>

<template>
  <section v-if="viewState === 'loading'" class="empty-state">
    <h3>正在加载这一天的内容</h3>
    <p>正在读取对应的日记文件...</p>
  </section>

  <section v-else-if="viewState === 'no-workspace'" class="empty-state">
    <h3>请选择一个目录开始记录</h3>
    <p>选择一个目录开始记录，dAiry 会在里面按年、月整理你的日记文件。</p>
    <button class="primary-button" type="button" @click="$emit('chooseWorkspace')">
      选择目录
    </button>
  </section>

  <section v-else-if="viewState === 'today-empty'" class="empty-state">
    <h3>今天还没有写日记</h3>
    <p>新建日记，然后开始记录吧</p>
    <button class="primary-button" type="button" :disabled="isCreatingEntry" @click="$emit('createEntry')">
      {{ isCreatingEntry ? '正在创建...' : '新建日记' }}
    </button>
  </section>

  <section v-else-if="viewState === 'history-empty'" class="empty-state">
    <h3>这一天没有写日记</h3>
    <p>也许是忘记了呢...</p>
    <button class="primary-button" type="button" :disabled="isCreatingEntry" @click="$emit('createEntry')">
      {{ isCreatingEntry ? '正在创建...' : '补写日记' }}
    </button>
  </section>

  <section v-else-if="viewState === 'future-empty'" class="empty-state">
    <h3>这一天还没有到来</h3>
    <p>想要有时光机...</p>
  </section>

  <section v-else-if="viewState === 'error'" class="empty-state empty-state--error">
    <h3>读取内容时出了点问题</h3>
    <p>{{ statusMessage }}</p>
    <button class="primary-button" type="button" @click="$emit('reloadEntry')">
      重新读取
    </button>
  </section>

  <section v-else class="editor-panel">
    <textarea
      v-if="editorMode === 'source'"
      ref="textareaRef"
      v-model="editorContentModel"
      class="editor-textarea"
      :placeholder="isSelectedDateToday ? '在这里开始写今天的内容吧...' : '在这里开始写这一天的内容吧...'"
      spellcheck="false"
      @keydown="handleEditorKeydown"
      @mouseup="updateSelection"
      @keyup="updateSelection"
    />

    <div
      v-else
      class="markdown-preview"
      @click="handlePreviewClick"
    >
      <div v-if="editorContent.trim()" class="markdown-body" v-html="renderedMarkdown" />
      <div v-else class="markdown-placeholder">
        这篇日记还没有内容，切回源码视图就可以开始写 Markdown 了。
      </div>
    </div>

    <div v-if="editorMode === 'source'" class="word-count-bar">
      {{ selectedWordCount > 0 ? `${selectedWordCount} / ${totalWordCount} 词` : `${totalWordCount} 词` }}
    </div>
  </section>
</template>

<style scoped src="./JournalEditorPanel.css"></style>
