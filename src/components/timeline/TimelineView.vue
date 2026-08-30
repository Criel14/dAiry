<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineEvent } from '../../types/timeline'
import TimelineCard from './TimelineCard.vue'

const EVENT_COLORS = [
  'var(--color-timeline-event-1)',
  'var(--color-timeline-event-2)',
  'var(--color-timeline-event-3)',
  'var(--color-timeline-event-4)',
  'var(--color-timeline-event-5)',
  'var(--color-timeline-event-6)',
  'var(--color-timeline-event-7)',
  'var(--color-timeline-event-8)',
]

const props = defineProps<{
  events: TimelineEvent[]
  year: number
}>()

const emit = defineEmits<{
  jumpToDiary: [date: string]
}>()

const monthGroups = computed(() => {
  const groups: Array<{ month: number; events: Array<TimelineEvent & { color: string }> }> = []

  for (let m = 1; m <= 12; m++) {
    const monthEvents = props.events
      .filter((e) => {
        const eventMonth = Number.parseInt(e.date.split('-')[1], 10)
        return eventMonth === m
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    if (monthEvents.length > 0) {
      groups.push({
        month: m,
        events: monthEvents.map((e, i) => ({
          ...e,
          color: EVENT_COLORS[i % EVENT_COLORS.length],
        })),
      })
    }
  }

  return groups
})

const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]
</script>

<template>
  <div class="timeline-view">
    <template v-if="monthGroups.length === 0">
      <div class="timeline-empty-state">
        <h3>{{ year }} 年暂无事件</h3>
        <p>在左侧点击"重新整理本年度时间轴"让 AI 自动提取事件</p>
      </div>
    </template>

    <template v-for="group in monthGroups" :key="group.month">
      <div class="timeline-month">
        <div class="timeline-month-label">{{ MONTH_LABELS[group.month - 1] }}</div>

        <div class="timeline-events">
          <div
            v-for="event in group.events"
            :key="event.id"
            class="timeline-event-row"
          >
            <div class="timeline-event-marker">
              <div
                class="timeline-event-dot"
                :style="{ backgroundColor: event.color }"
              ></div>
            </div>

            <span class="timeline-event-date" :style="{ color: event.color }">
              {{ event.date }}
            </span>

            <TimelineCard
              :event="event"
              :color="event.color"
              @jump-to-diary="date => emit('jumpToDiary', date)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped src="./TimelineView.css"></style>
