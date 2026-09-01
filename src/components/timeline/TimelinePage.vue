<script setup lang="ts">
import type { TimelineEvent, TimelineYearData } from '../../types/timeline'
import TimelineView from './TimelineView.vue'
import TimelineEventModal from './components/TimelineEventModal/TimelineEventModal.vue'

defineProps<{
  workspacePath: string | null
  selectedYear: number
  timelineData: TimelineYearData | null
  isRebuilding: boolean
  rebuildProgress: { weekLabel: string; current: number; total: number } | null
  eventModalOpen: boolean
  editingEvent: TimelineEvent | null
}>()

const emit = defineEmits<{
  jumpToDiary: [date: string]
  openCreateEvent: []
  openEditEvent: [event: TimelineEvent]
  closeEventModal: []
  eventModalSaved: []
  deleteEvent: [event: TimelineEvent]
}>()
</script>

<template>
  <div class="timeline-page">
    <header class="timeline-header">
      <div class="timeline-heading">
        <h2 class="timeline-title">{{ selectedYear }} 年大事件时间轴</h2>
      </div>
      <button
        v-if="workspacePath"
        class="timeline-add-button"
        type="button"
        @click="emit('openCreateEvent')"
      >
        添加事件
      </button>
    </header>

    <div v-if="!workspacePath" class="timeline-empty">
      <h3>人生时间轴</h3>
      <p>先选择一个工作区，右侧这里会显示时间轴。</p>
    </div>
    <TimelineView
      v-else
      :events="timelineData?.events ?? []"
      :year="selectedYear"
      @jump-to-diary="date => emit('jumpToDiary', date)"
      @open-edit-event="event => emit('openEditEvent', event)"
      @delete-event="event => emit('deleteEvent', event)"
    />

    <TimelineEventModal
      :open="eventModalOpen"
      :editing="editingEvent"
      :workspace-path="workspacePath"
      @close="emit('closeEventModal')"
      @saved="emit('eventModalSaved')"
    />
  </div>
</template>

<style scoped src="./TimelinePage.css"></style>
