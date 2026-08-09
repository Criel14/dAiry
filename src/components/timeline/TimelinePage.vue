<script setup lang="ts">
import type { TimelineYearData } from '../../types/timeline'
import TimelineView from './TimelineView.vue'

defineProps<{
  workspacePath: string | null
  selectedYear: number
  timelineData: TimelineYearData | null
}>()

const emit = defineEmits<{
  jumpToDiary: [date: string]
}>()
</script>

<template>
  <div class="timeline-page">
    <header class="timeline-header">
      <div class="timeline-heading">
        <h2 class="timeline-title">{{ selectedYear }} 年大事件时间轴</h2>
      </div>
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
    />
  </div>
</template>

<style scoped src="./TimelinePage.css"></style>
