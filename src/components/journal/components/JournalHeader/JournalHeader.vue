<script setup lang="ts">
import { ChevronLeft, ChevronRight, CodeXml, Eye } from 'lucide-vue-next'
import type { EditorMode } from '../../../../types/ui'

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
  previousDate: []
  nextDate: []
  saveEntry: []
}>()
</script>

<template>
  <header class="editor-header">
    <div class="editor-heading">
      <p class="editor-kicker">Journal</p>
      <div class="editor-title-row">
        <div class="date-switcher" aria-label="日记日期切换">
          <button
            class="date-switch-button"
            type="button"
            title="前一天"
            aria-label="前一天"
            @click="$emit('previousDate')"
          >
            <ChevronLeft class="date-switch-icon" aria-hidden="true" />
          </button>

          <h2 class="editor-title">
            {{ selectedDateText }}<span v-if="isDirty" class="editor-dirty-mark">*</span>
          </h2>

          <button
            class="date-switch-button"
            type="button"
            title="后一天"
            aria-label="后一天"
            @click="$emit('nextDate')"
          >
            <ChevronRight class="date-switch-icon" aria-hidden="true" />
          </button>
        </div>
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
            <CodeXml class="view-mode-icon" aria-hidden="true" />
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
            <Eye class="view-mode-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped src="./JournalHeader.css"></style>
