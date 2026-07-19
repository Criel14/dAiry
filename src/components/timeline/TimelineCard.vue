<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronUp, FileText } from 'lucide-vue-next'
import type { TimelineEvent } from '../../types/timeline'

defineProps<{
  event: TimelineEvent
  color: string
}>()

const emit = defineEmits<{
  jumpToDiary: [date: string]
}>()

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div
    class="timeline-card"
    :class="{ 'timeline-card--expanded': isExpanded }"
  >
    <div class="timeline-card-header" @click="toggleExpand">
      <span class="timeline-card-date">
        {{ event.date }}
        <template v-if="event.dateEnd"> ~ {{ event.dateEnd }}</template>
      </span>
      <span class="timeline-card-title">{{ event.title }}</span>
      <component
        :is="isExpanded ? ChevronUp : ChevronDown"
        class="timeline-card-chevron"
        aria-hidden="true"
      />
    </div>

    <div v-if="isExpanded" class="timeline-card-detail">
      <p>{{ event.detail }}</p>
      <div v-if="event.diaryDates.length > 0" class="timeline-card-links">
        <button
          v-for="d in event.diaryDates"
          :key="d"
          class="timeline-card-diary-link"
          @click.stop="emit('jumpToDiary', d)"
        >
          <FileText class="link-icon" />
          {{ d }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TimelineCard.css"></style>
