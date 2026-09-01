<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, FileText, Pencil, Trash2 } from 'lucide-vue-next'
import type { TimelineEvent } from '../../types/timeline'

const props = defineProps<{
  event: TimelineEvent
  color: string
}>()

const emit = defineEmits<{
  jumpToDiary: [date: string]
  openEditEvent: [event: TimelineEvent]
  deleteEvent: [event: TimelineEvent]
}>()

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

const detailText = computed(() => {
  return props.event.detail.replace(/\\n/g, '\n')
})
</script>

<template>
  <div
    class="timeline-card"
    :class="{ 'timeline-card--expanded': isExpanded }"
  >
    <div class="timeline-card-header" @click="toggleExpand">
      <span class="timeline-card-title">{{ event.title }}</span>
      <component
        :is="isExpanded ? ChevronUp : ChevronDown"
        class="timeline-card-chevron"
        aria-hidden="true"
      />
    </div>

    <div v-if="isExpanded" class="timeline-card-detail">
      <p class="timeline-card-detail-text">{{ detailText }}</p>
      <div class="timeline-card-links">
        <button
          v-for="d in event.diaryDates"
          :key="d"
          class="timeline-card-diary-link"
          :title="d"
          @click.stop="emit('jumpToDiary', d)"
        >
          <FileText class="link-icon" aria-hidden="true" />
        </button>
        <button
          class="timeline-card-diary-link"
          type="button"
          title="编辑"
          @click.stop="emit('openEditEvent', event)"
        >
          <Pencil class="link-icon" aria-hidden="true" />
        </button>
        <button
          class="timeline-card-diary-link timeline-card-diary-link--danger"
          type="button"
          title="删除"
          @click.stop="emit('deleteEvent', event)"
        >
          <Trash2 class="link-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TimelineCard.css"></style>
