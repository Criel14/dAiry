<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import type { EditorMode, ViewState } from '../types/ui'

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
    <p>先在左上角选择日记目录，dAiry 会在里面按年、月整理你的日记文件。</p>
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
      v-model="editorContentModel"
      class="editor-textarea"
      placeholder="在这里开始写今天的内容吧..."
      spellcheck="false"
      @keydown="handleEditorKeydown"
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
  </section>
</template>

<style scoped>
.editor-panel,
.empty-state {
  display: grid;
  align-content: stretch;
  min-height: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

.editor-panel {
  grid-template-rows: 1fr;
  min-height: 0;
  padding-top: 1rem;
}

.empty-state {
  gap: 1rem;
  align-content: center;
  justify-items: start;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
}

.empty-state h3 {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.5rem;
}

.empty-state p,
.markdown-placeholder {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.empty-state--error {
  border-color: #dbcfa3;
}

.primary-button {
  min-height: 2.7rem;
  padding: 0 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #f5ebc3;
  color: #4f4630;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.primary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
  transform: none;
}

.editor-textarea,
.markdown-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-main);
  font-size: 1.02rem;
  line-height: 1.9;
  outline: none;
}

.editor-textarea {
  resize: none;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
}

.markdown-preview {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
}

.editor-textarea::-webkit-scrollbar,
.markdown-preview::-webkit-scrollbar {
  width: 10px;
}

.editor-textarea::-webkit-scrollbar-track,
.markdown-preview::-webkit-scrollbar-track {
  background: transparent;
}

.editor-textarea::-webkit-scrollbar-thumb,
.markdown-preview::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.editor-textarea::-webkit-scrollbar-thumb:hover,
.markdown-preview::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
}

.editor-textarea::-webkit-scrollbar-corner,
.markdown-preview::-webkit-scrollbar-corner {
  background: transparent;
}

.markdown-body {
  width: 100%;
  max-width: none;
  margin: 0;
  padding-bottom: 3rem;
  color: var(--color-text-main);
  line-height: 1.9;
  word-break: break-word;
}

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child),
.markdown-body :deep(h5:first-child),
.markdown-body :deep(h6:first-child),
.markdown-body :deep(p:first-child),
.markdown-body :deep(ul:first-child),
.markdown-body :deep(ol:first-child),
.markdown-body :deep(blockquote:first-child),
.markdown-body :deep(pre:first-child),
.markdown-body :deep(table:first-child),
.markdown-body :deep(hr:first-child) {
  margin-top: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.8em 0 0.65em;
  line-height: 1.35;
  color: var(--color-text-main);
}

.markdown-body :deep(h1) {
  font-size: 2rem;
}

.markdown-body :deep(h2) {
  font-size: 1.55rem;
}

.markdown-body :deep(h3) {
  font-size: 1.25rem;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre),
.markdown-body :deep(table) {
  margin: 0 0 1.1rem;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5rem;
}

.markdown-body :deep(li + li) {
  margin-top: 0.35rem;
}

.markdown-body :deep(blockquote) {
  padding: 0.9rem 1rem;
  border-left: 3px solid var(--color-border-strong);
  border-radius: 0 8px 8px 0;
  background: var(--color-surface-muted);
  color: var(--color-text-subtle);
}

.markdown-body :deep(code) {
  padding: 0.12rem 0.38rem;
  border-radius: 6px;
  background: #f3ede0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.92em;
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fcfbf6;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-body :deep(hr) {
  margin: 1.6rem 0;
  border: 0;
  border-top: 1px solid var(--color-border);
}

.markdown-body :deep(a) {
  color: #7c6a3b;
  text-decoration: underline;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 10px;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--color-border-soft);
  text-align: left;
}

.markdown-body :deep(th) {
  background: #fbf6e7;
}

.markdown-placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  text-align: center;
}
</style>
