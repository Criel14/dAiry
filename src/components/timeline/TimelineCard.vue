<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, FileText } from 'lucide-vue-next'
import type { TimelineEvent } from '../../types/timeline'

const props = defineProps<{
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
