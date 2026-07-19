<script setup lang="ts">
import type { TimelineYearData } from '../../types/timeline'
import TimelineSidebar from './TimelineSidebar.vue'
import TimelineView from './TimelineView.vue'

defineProps<{
  workspacePath: string | null
  selectedYear: number
  timelineData: TimelineYearData | null
  isRebuilding: boolean
  rebuildProgress: { weekLabel: string; current: number; total: number } | null
}>()

const emit = defineEmits<{
  selectYear: [year: number]
  rebuild: []
  cancelRebuild: []
  jumpToDiary: [date: string]
}>()
</script>

<template>
  <div class="timeline-page">
    <TimelineSidebar
      :selected-year="selectedYear"
      :has-data-years="timelineData ? new Set([String(selectedYear)]) : new Set()"
      :is-rebuilding="isRebuilding"
      :rebuild-progress="rebuildProgress"
      @select-year="year => emit('selectYear', year)"
      @rebuild="emit('rebuild')"
      @cancel-rebuild="emit('cancelRebuild')"
    />
    <div class="timeline-content">
      <div v-if="!workspacePath" class="timeline-empty">
        <h3>人生时间轴</h3>
        <p>先选择一个工作区，右侧这里会显示时间轴。</p>
      </div>
      <TimelineView
        v-else
        :events="timelineData?.events ?? []"
        :year="selectedYear"
        @jump-to-diary="date => emit('jumpToDiary', date)"
      />
    </div>
  </div>
</template>

<style scoped src="./TimelinePage.css"></style>
