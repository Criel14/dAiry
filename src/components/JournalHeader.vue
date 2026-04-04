<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { EditorMode } from '../types/ui'

defineProps<{
  selectedDateText: string
  isDirty: boolean
  saveMetaText: string
  editorMode: EditorMode
  isJournalReady: boolean
}>()

defineEmits<{
  'update:editorMode': [mode: EditorMode]
}>()
</script>

<template>
  <header class="editor-header">
    <div class="editor-heading">
      <p class="editor-kicker">Journal</p>
      <div class="editor-title-row">
        <h2 class="editor-title">
          {{ selectedDateText }}<span v-if="isDirty" class="editor-dirty-mark">*</span>
        </h2>
      </div>
      <p class="editor-description">简单地写下今天的心情与发生的事情吧</p>
    </div>

    <div class="editor-actions">
      <span class="save-meta">{{ saveMetaText }}</span>

      <div class="editor-view-modes" role="tablist" aria-label="编辑区视图切换">
        <button
          class="view-mode-button"
          :class="{ 'view-mode-button--active': editorMode === 'source' }"
          type="button"
          title="源码视图"
          aria-label="源码视图"
          :disabled="!isJournalReady"
          @click="$emit('update:editorMode', 'source')"
        >
          <Icon class="view-mode-icon" icon="lucide:code-xml" aria-hidden="true" />
        </button>

        <button
          class="view-mode-button"
          :class="{ 'view-mode-button--active': editorMode === 'preview' }"
          type="button"
          title="阅读视图"
          aria-label="阅读视图"
          :disabled="!isJournalReady"
          @click="$emit('update:editorMode', 'preview')"
        >
          <Icon class="view-mode-icon" icon="lucide:eye" aria-hidden="true" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.editor-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.editor-heading {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.editor-kicker {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.editor-title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.editor-title {
  margin: 0;
  font-size: 1.8rem;
  color: var(--color-text-main);
}

.editor-dirty-mark {
  margin-left: 0.2rem;
  color: #b89133;
}

.editor-description {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 0.95rem;
}

.editor-actions {
  display: flex;
  gap: 0.6rem;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  align-self: stretch;
}

.save-meta {
  min-height: 1.2rem;
  font-size: 0.84rem;
  color: var(--color-text-soft);
}

.editor-view-modes {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-shrink: 0;
}

.view-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fffdf8;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease,
    opacity 160ms ease;
}

.view-mode-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.view-mode-icon {
  width: 1.15rem;
  height: 1.15rem;
}

.view-mode-button--active {
  border-color: var(--color-border-strong);
  background: #f5ebc3;
  color: #4f4630;
  box-shadow: none;
}

.view-mode-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
  transform: none;
  box-shadow: none;
}

@media (max-width: 768px) {
  .editor-header,
  .editor-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-actions {
    justify-content: flex-start;
  }

  .editor-view-modes {
    justify-content: flex-start;
  }
}
</style>
