<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { EditorMode } from '../../types/ui'

defineProps<{
  selectedDateText: string
  isSelectedDateToday: boolean
  isDirty: boolean
  saveMetaText: string
  editorMode: EditorMode
  isJournalReady: boolean
  canSaveEntry: boolean
  isSavingEntry: boolean
}>()

defineEmits<{
  'update:editorMode': [mode: EditorMode]
  saveEntry: []
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
        <span v-if="isSelectedDateToday" class="today-badge">今天</span>
      </div>
      <p class="editor-description">简单地写下今天的心情与发生的事情吧</p>
    </div>

    <div class="editor-actions">
      <span class="save-meta">{{ saveMetaText }}</span>

      <div class="editor-action-row">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveEntry"
          @click="$emit('saveEntry')"
        >
          {{ isSavingEntry ? '正在保存' : '保存正文' }}
        </button>

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
    </div>
  </header>
</template>

<style scoped src="./JournalHeader.css"></style>
